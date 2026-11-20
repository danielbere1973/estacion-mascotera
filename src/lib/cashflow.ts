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

// Importes por fila: 12 (enero a diciembre) en el cashflow anual, 1 en un total de período.
export type Cashflow = Record<ClaveFila, number[]>;

const CLAVE_POR_TIPO_GASTO = {
  FIJO: "gastosFijos",
  VARIABLE: "gastosVariables",
  MARKETING: "gastosMarketing",
  EXCEPCIONAL: "gastosExcepcionales",
} as const;

// Cashflow del año, mes a mes (índice 0 = enero).
export function getCashflowAnual(anio: number): Promise<Cashflow> {
  const rango = { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) };
  return calcularMovimientos(rango, 12, (fecha) => fecha.getUTCMonth());
}

// Totales de un período cualquiera (sin desde/hasta = todo), por fila. Lo usa Dashboard 2.
export async function getTotalesPeriodo(periodo: { desde?: Date; hasta?: Date }): Promise<Record<ClaveFila, number>> {
  const rango = { ...(periodo.desde ? { gte: periodo.desde } : {}), ...(periodo.hasta ? { lt: periodo.hasta } : {}) };
  const cf = await calcularMovimientos(rango, 1, () => 0);
  return Object.fromEntries(Object.entries(cf).map(([clave, valores]) => [clave, valores[0]])) as Record<ClaveFila, number>;
}

// Suma cada movimiento en su fila y en la columna que indique `columna` (mes, o 0 si es un solo total).
async function calcularMovimientos(
  rango: { gte?: Date; lt?: Date },
  columnas: number,
  columna: (fecha: Date) => number
): Promise<Cashflow> {
  const [ventas, consignaciones, compras, gastos] = await Promise.all([
    prisma.venta.findMany({
      where: { fechaVenta: rango },
      select: {
        fechaVenta: true,
        esVentaInterna: true,
        costoEnvio: true,
        detalles: { select: { cantidad: true, precioVentaUnitario: true, descuentoPorcentaje: true } },
        costos: { select: { montoCalculado: true } },
      },
    }),
    prisma.ventaConsignacion.findMany({
      where: { fecha: rango, detalleVentaId: null, detalle: { consignacion: { direccion: "RECIBIMOS" } } },
      select: { fecha: true, cantidad: true, precioVentaReal: true, detalle: { select: { precioCosto: true } } },
    }),
    prisma.compra.findMany({
      where: { fechaCompra: rango },
      select: { fechaCompra: true, cantidad: true, precioCostoUnitario: true, descuentoPorcentaje: true, costoEnvio: true },
    }),
    prisma.gasto.findMany({
      where: { fechaGasto: rango },
      select: { fechaGasto: true, monto: true, tipoGasto: true },
    }),
  ]);

  const cf = Object.fromEntries(
    [...FILAS_INGRESO, ...FILAS_EGRESO].map((f) => [f.clave, Array<number>(columnas).fill(0)])
  ) as Cashflow;
  const sumar = (clave: ClaveFila, fecha: Date, monto: number) => {
    cf[clave][columna(fecha)] += monto;
  };

  for (const v of ventas) {
    const total =
      v.detalles.reduce(
        (acc, d) => acc + d.cantidad * Number(d.precioVentaUnitario) * (1 - Number(d.descuentoPorcentaje ?? 0) / 100),
        0
      ) + Number(v.costoEnvio);
    sumar(v.esVentaInterna ? "ventasInternas" : "ventas", v.fechaVenta, total);
    sumar("comisiones", v.fechaVenta, v.costos.reduce((acc, c) => acc + Number(c.montoCalculado), 0));
  }

  for (const c of consignaciones) {
    const ganancia = Number(c.precioVentaReal) - Number(c.detalle.precioCosto);
    sumar("consignaciones", c.fecha, ((ganancia * 2) / 3) * c.cantidad);
  }

  for (const c of compras) {
    const total =
      c.cantidad * Number(c.precioCostoUnitario) * (1 - Number(c.descuentoPorcentaje) / 100) + Number(c.costoEnvio ?? 0);
    sumar("compras", c.fechaCompra, total);
  }

  for (const g of gastos) {
    sumar(CLAVE_POR_TIPO_GASTO[g.tipoGasto], g.fechaGasto, Number(g.monto));
  }

  return cf;
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

// Ingresos pendientes de cobro de las ventas del período: lo que falta cobrar de cada venta
// (total − pagos registrados), con el mismo criterio que el estado "Pendiente de pago" /
// "Parcialmente pagado" de la pantalla de Ventas. Ventas internas, aparte.
export type PendienteCobro = { monto: number; ventas: number };

export async function getPendientesCobro(periodo: {
  desde?: Date;
  hasta?: Date;
}): Promise<{ ventas: PendienteCobro; ventasInternas: PendienteCobro }> {
  const fechaVenta = { ...(periodo.desde ? { gte: periodo.desde } : {}), ...(periodo.hasta ? { lt: periodo.hasta } : {}) };
  const ventas = await prisma.venta.findMany({
    where: { fechaVenta },
    select: {
      esVentaInterna: true,
      costoEnvio: true,
      detalles: { select: { cantidad: true, precioVentaUnitario: true, descuentoPorcentaje: true } },
      pagos: { select: { monto: true } },
    },
  });

  const resultado = { ventas: { monto: 0, ventas: 0 }, ventasInternas: { monto: 0, ventas: 0 } };
  for (const v of ventas) {
    const total =
      v.detalles.reduce(
        (acc, d) => acc + d.cantidad * Number(d.precioVentaUnitario) * (1 - Number(d.descuentoPorcentaje ?? 0) / 100),
        0
      ) + Number(v.costoEnvio);
    const pendiente = total - v.pagos.reduce((acc, p) => acc + Number(p.monto), 0);
    if (pendiente <= 0.01) continue;
    const fila = v.esVentaInterna ? resultado.ventasInternas : resultado.ventas;
    fila.monto += pendiente;
    fila.ventas++;
  }
  return resultado;
}

// Egresos pendientes de pago del período: compras de mercadería sin marcar como pagadas
// (cantidad × costo con descuento + envío), agrupadas por proveedor de mayor a menor.
// Los gastos no tienen estado de pago: se cargan ya pagados, así que no entran.
export async function getEgresosPendientes(periodo: {
  desde?: Date;
  hasta?: Date;
}): Promise<{ monto: number; compras: number; porProveedor: { proveedor: string; monto: number; compras: number }[] }> {
  const fechaCompra = { ...(periodo.desde ? { gte: periodo.desde } : {}), ...(periodo.hasta ? { lt: periodo.hasta } : {}) };
  const compras = await prisma.compra.findMany({
    where: { fechaCompra, pagado: false },
    select: {
      cantidad: true,
      precioCostoUnitario: true,
      descuentoPorcentaje: true,
      costoEnvio: true,
      proveedor: { select: { nombre: true } },
    },
  });

  const porProveedor = new Map<string, { monto: number; compras: number }>();
  let monto = 0;
  for (const c of compras) {
    const total =
      c.cantidad * Number(c.precioCostoUnitario) * (1 - Number(c.descuentoPorcentaje) / 100) + Number(c.costoEnvio ?? 0);
    monto += total;
    const fila = porProveedor.get(c.proveedor.nombre) ?? { monto: 0, compras: 0 };
    fila.monto += total;
    fila.compras++;
    porProveedor.set(c.proveedor.nombre, fila);
  }
  return {
    monto,
    compras: compras.length,
    porProveedor: [...porProveedor].map(([proveedor, f]) => ({ proveedor, ...f })).sort((a, b) => b.monto - a.monto),
  };
}
