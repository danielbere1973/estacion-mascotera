import { prisma } from "@/lib/prisma";

// Cashflow (mensual de un año) y totales de Dashboard 2. Parte de los criterios del Dashboard
// (lib/metrics.ts), salvo que acá las ventas internas suman como ingreso:
// - Ventas: detalle × precio con descuento + envío cobrado al cliente, por fecha de venta.
// - Ventas internas: mismo cálculo, en su propia fila. A diferencia del Dashboard, acá suman:
//   se retribuye su costo y se registra la venta, así que es plata que entra.
// - Consignaciones: nuestra comisión (2/3 de la ganancia) de lo recibido en consignación que se
//   registró sin "Nueva venta" (con venta vinculada ya está dentro de Ventas).
// - Compras: cantidad × costo con descuento + envío, por fecha de compra.
// - Comisiones de cobro: costos de cada venta (CostoVenta), por fecha de venta.
// - Gastos: por tipo (fijos, variables, marketing, excepcionales), por fecha del gasto.
// Los meses se cortan en UTC, igual que los períodos del Dashboard.

export const FILAS_INGRESO = [
  { clave: "ventas", label: "Ventas" },
  { clave: "ventasInternas", label: "Ventas internas" },
  { clave: "consignaciones", label: "Comisión consignaciones" },
] as const;

export const FILAS_EGRESO = [
  { clave: "compras", label: "Compras de mercadería" },
  { clave: "comisiones", label: "Comisiones de cobro" },
  { clave: "gastosFijos", label: "Gastos fijos" },
  { clave: "gastosVariables", label: "Gastos variables" },
  { clave: "gastosMarketing", label: "Marketing" },
  { clave: "gastosExcepcionales", label: "Gastos excepcionales" },
] as const;

export type ClaveFila = (typeof FILAS_INGRESO)[number]["clave"] | (typeof FILAS_EGRESO)[number]["clave"];

// Importes por fila: 12 (enero a diciembre) en el cashflow anual.
export type Cashflow = Record<ClaveFila, number[]>;

const CLAVE_POR_TIPO_GASTO = {
  FIJO: "gastosFijos",
  VARIABLE: "gastosVariables",
  MARKETING: "gastosMarketing",
  EXCEPCIONAL: "gastosExcepcionales",
} as const;

type Rango = { gte?: Date; lt?: Date };
type Periodo = { desde?: Date; hasta?: Date };
const aRango = (periodo: Periodo): Rango => ({
  ...(periodo.desde ? { gte: periodo.desde } : {}),
  ...(periodo.hasta ? { lt: periodo.hasta } : {}),
});

// Un movimiento que suma en una fila del cashflow. Los totales (Cashflow, Dashboard 2) salen de
// sumar estas mismas listas, así el detalle de Dashboard 2 siempre coincide con su cuadro.
export type Movimiento = {
  clave: ClaveFila;
  fecha: Date;
  monto: number;
  titulo: string;
  detalle?: string;
  href?: string;
};

const pesos = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const totalDetalles = (detalles: { cantidad: number; precioVentaUnitario: unknown; descuentoPorcentaje: unknown }[]) =>
  detalles.reduce(
    (acc, d) => acc + d.cantidad * Number(d.precioVentaUnitario) * (1 - Number(d.descuentoPorcentaje ?? 0) / 100),
    0
  );
const totalCompra = (c: { cantidad: number; precioCostoUnitario: unknown; descuentoPorcentaje: unknown; costoEnvio: unknown }) =>
  c.cantidad * Number(c.precioCostoUnitario) * (1 - Number(c.descuentoPorcentaje ?? 0) / 100) + Number(c.costoEnvio ?? 0);
const detalleCompra = (c: { cantidad: number; precioCostoUnitario: unknown; descuentoPorcentaje: unknown; costoEnvio: unknown }) =>
  `${c.cantidad} × $${pesos(Number(c.precioCostoUnitario))}` +
  (Number(c.descuentoPorcentaje) ? ` − ${Number(c.descuentoPorcentaje)}%` : "") +
  (Number(c.costoEnvio ?? 0) ? ` + envío $${pesos(Number(c.costoEnvio))}` : "");
const nombreCliente = (c: { nombre: string; apellido: string }) => `${c.nombre} ${c.apellido}`.trim();

// Todos los movimientos del rango (sin desde/hasta = todo).
export async function getMovimientos(rango: Rango): Promise<Movimiento[]> {
  const [ventas, consignaciones, compras, gastos] = await Promise.all([
    prisma.venta.findMany({
      where: { fechaVenta: rango },
      select: {
        id: true,
        fechaVenta: true,
        esVentaInterna: true,
        costoEnvio: true,
        cliente: { select: { nombre: true, apellido: true } },
        detalles: {
          select: { cantidad: true, precioVentaUnitario: true, descuentoPorcentaje: true, producto: { select: { nombre: true } } },
        },
        costos: { select: { concepto: true, montoCalculado: true } },
      },
    }),
    prisma.ventaConsignacion.findMany({
      where: { fecha: rango, detalleVentaId: null, detalle: { consignacion: { direccion: "RECIBIMOS" } } },
      select: {
        fecha: true,
        cantidad: true,
        precioVentaReal: true,
        detalle: {
          select: {
            precioCosto: true,
            descripcion: true,
            producto: { select: { nombre: true } },
            consignacion: { select: { id: true, socio: { select: { nombre: true } } } },
          },
        },
      },
    }),
    prisma.compra.findMany({
      where: { fechaCompra: rango },
      select: {
        id: true,
        fechaCompra: true,
        cantidad: true,
        precioCostoUnitario: true,
        descuentoPorcentaje: true,
        costoEnvio: true,
        proveedor: { select: { nombre: true } },
        producto: { select: { nombre: true } },
      },
    }),
    prisma.gasto.findMany({
      where: { fechaGasto: rango },
      select: { id: true, fechaGasto: true, monto: true, tipoGasto: true, categoriaGasto: true, descripcion: true },
    }),
  ]);

  const movimientos: Movimiento[] = [];

  for (const v of ventas) {
    const href = `/ventas/${v.id}/editar`;
    const titulo = `Venta #${v.id} · ${nombreCliente(v.cliente)}`;
    const envio = Number(v.costoEnvio);
    movimientos.push({
      clave: v.esVentaInterna ? "ventasInternas" : "ventas",
      fecha: v.fechaVenta,
      monto: totalDetalles(v.detalles) + envio,
      titulo,
      detalle: v.detalles.map((d) => `${d.cantidad}x ${d.producto.nombre}`).join(", ") + (envio ? ` · envío $${pesos(envio)}` : ""),
      href,
    });
    const comision = v.costos.reduce((acc, c) => acc + Number(c.montoCalculado), 0);
    if (comision) {
      movimientos.push({
        clave: "comisiones",
        fecha: v.fechaVenta,
        monto: comision,
        titulo,
        detalle: v.costos.map((c) => c.concepto).join(", "),
        href,
      });
    }
  }

  for (const c of consignaciones) {
    const ganancia = Number(c.precioVentaReal) - Number(c.detalle.precioCosto);
    movimientos.push({
      clave: "consignaciones",
      fecha: c.fecha,
      monto: ((ganancia * 2) / 3) * c.cantidad,
      titulo: c.detalle.producto?.nombre ?? c.detalle.descripcion ?? "Producto en consignación",
      detalle: `${c.cantidad} u. · socio ${c.detalle.consignacion.socio.nombre} · 2/3 de la ganancia`,
      href: `/consignaciones/${c.detalle.consignacion.id}`,
    });
  }

  for (const c of compras) {
    movimientos.push({
      clave: "compras",
      fecha: c.fechaCompra,
      monto: totalCompra(c),
      titulo: `${c.proveedor.nombre} · ${c.producto.nombre}`,
      detalle: detalleCompra(c),
      href: `/inventario/compras/${c.id}/editar`,
    });
  }

  for (const g of gastos) {
    movimientos.push({
      clave: CLAVE_POR_TIPO_GASTO[g.tipoGasto],
      fecha: g.fechaGasto,
      monto: Number(g.monto),
      titulo: g.categoriaGasto,
      detalle: g.descripcion ?? undefined,
      href: `/gastos/${g.id}/editar`,
    });
  }

  return movimientos;
}

// Cashflow del año, mes a mes (índice 0 = enero).
export async function getCashflowAnual(anio: number): Promise<Cashflow> {
  const movimientos = await getMovimientos({ gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) });
  const cf = Object.fromEntries(
    [...FILAS_INGRESO, ...FILAS_EGRESO].map((f) => [f.clave, Array<number>(12).fill(0)])
  ) as Cashflow;
  for (const m of movimientos) cf[m.clave][m.fecha.getUTCMonth()] += m.monto;
  return cf;
}

// Movimientos de un período (sin desde/hasta = todo). Lo usa el detalle de Dashboard 2.
export function getMovimientosPeriodo(periodo: Periodo): Promise<Movimiento[]> {
  return getMovimientos(aRango(periodo));
}

// Totales de un período, por fila. Lo usa Dashboard 2.
export async function getTotalesPeriodo(periodo: Periodo): Promise<Record<ClaveFila, number>> {
  const movimientos = await getMovimientosPeriodo(periodo);
  const totales = Object.fromEntries([...FILAS_INGRESO, ...FILAS_EGRESO].map((f) => [f.clave, 0])) as Record<
    ClaveFila,
    number
  >;
  for (const m of movimientos) totales[m.clave] += m.monto;
  return totales;
}

// Años para el filtro: desde el primer movimiento cargado hasta el año actual.
export async function getAniosCashflow(): Promise<number[]> {
  const [venta, compra, gasto] = await Promise.all([
    prisma.venta.aggregate({ _min: { fechaVenta: true } }),
    prisma.compra.aggregate({ _min: { fechaCompra: true } }),
    prisma.gasto.aggregate({ _min: { fechaGasto: true } }),
  ]);
  const actual = new Date().getUTCFullYear();
  const primeros = [venta._min.fechaVenta, compra._min.fechaCompra, gasto._min.fechaGasto]
    .filter((f): f is Date => f != null)
    .map((f) => f.getUTCFullYear());
  const desde = Math.min(actual, ...primeros);
  return Array.from({ length: actual - desde + 1 }, (_, i) => actual - i);
}

// Ventas del período con saldo sin cobrar: total − pagos registrados, mismo criterio que el estado
// "Pendiente de pago" / "Parcialmente pagado" de la pantalla de Ventas.
export type VentaPendiente = Omit<Movimiento, "clave"> & { interna: boolean };

export async function getVentasPendientesCobro(periodo: Periodo): Promise<VentaPendiente[]> {
  const ventas = await prisma.venta.findMany({
    where: { fechaVenta: aRango(periodo) },
    select: {
      id: true,
      fechaVenta: true,
      esVentaInterna: true,
      costoEnvio: true,
      cliente: { select: { nombre: true, apellido: true } },
      detalles: { select: { cantidad: true, precioVentaUnitario: true, descuentoPorcentaje: true } },
      pagos: { select: { monto: true } },
    },
  });
  return ventas.flatMap((v) => {
    const total = totalDetalles(v.detalles) + Number(v.costoEnvio);
    const pagado = v.pagos.reduce((acc, p) => acc + Number(p.monto), 0);
    const pendiente = total - pagado;
    if (pendiente <= 0.01) return [];
    return [
      {
        interna: v.esVentaInterna,
        fecha: v.fechaVenta,
        monto: pendiente,
        titulo: `Venta #${v.id} · ${nombreCliente(v.cliente)}`,
        detalle: `Total $${pesos(total)} · pagado $${pesos(pagado)}`,
        href: `/ventas/${v.id}/editar`,
      },
    ];
  });
}

export type PendienteCobro = { monto: number; ventas: number };

export async function getPendientesCobro(periodo: Periodo): Promise<{ ventas: PendienteCobro; ventasInternas: PendienteCobro }> {
  const resultado = { ventas: { monto: 0, ventas: 0 }, ventasInternas: { monto: 0, ventas: 0 } };
  for (const v of await getVentasPendientesCobro(periodo)) {
    const fila = v.interna ? resultado.ventasInternas : resultado.ventas;
    fila.monto += v.monto;
    fila.ventas++;
  }
  return resultado;
}

// Compras de mercadería del período sin marcar como pagadas (cantidad × costo con descuento + envío).
// Los gastos no tienen estado de pago: se cargan ya pagados, así que no entran.
export type CompraImpaga = Omit<Movimiento, "clave"> & { proveedorId: number; proveedor: string };

export async function getComprasImpagas(periodo: Periodo, proveedorId?: number): Promise<CompraImpaga[]> {
  const compras = await prisma.compra.findMany({
    where: { fechaCompra: aRango(periodo), pagado: false, ...(proveedorId ? { proveedorId } : {}) },
    select: {
      id: true,
      fechaCompra: true,
      cantidad: true,
      precioCostoUnitario: true,
      descuentoPorcentaje: true,
      costoEnvio: true,
      proveedor: { select: { id: true, nombre: true } },
      producto: { select: { nombre: true } },
    },
  });
  return compras.map((c) => ({
    proveedorId: c.proveedor.id,
    proveedor: c.proveedor.nombre,
    fecha: c.fechaCompra,
    monto: totalCompra(c),
    titulo: `${c.proveedor.nombre} · ${c.producto.nombre}`,
    detalle: detalleCompra(c),
    href: `/inventario/compras/${c.id}/editar`,
  }));
}

// Egresos pendientes agrupados por proveedor, de mayor a menor.
export async function getEgresosPendientes(periodo: Periodo): Promise<{
  monto: number;
  compras: number;
  porProveedor: { proveedorId: number; proveedor: string; monto: number; compras: number }[];
}> {
  const compras = await getComprasImpagas(periodo);
  const porProveedor = new Map<number, { proveedorId: number; proveedor: string; monto: number; compras: number }>();
  for (const c of compras) {
    const fila = porProveedor.get(c.proveedorId) ?? { proveedorId: c.proveedorId, proveedor: c.proveedor, monto: 0, compras: 0 };
    fila.monto += c.monto;
    fila.compras++;
    porProveedor.set(c.proveedorId, fila);
  }
  return {
    monto: compras.reduce((acc, c) => acc + c.monto, 0),
    compras: compras.length,
    porProveedor: [...porProveedor.values()].sort((a, b) => b.monto - a.monto),
  };
}
