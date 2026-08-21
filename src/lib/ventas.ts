import { Prisma, CanalVenta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarLog } from "@/lib/log";

export type ItemVentaInput = {
  productoId: number;
  cantidad: number;
  precioVentaUnitario: number;
  descuentoPorcentaje?: number;
  detalleConsignacionId?: number | null;
};

export type CostoVentaInput = {
  concepto: string;
  esPorcentaje: boolean;
  valor: number;
  incluyeEnvio: boolean;
};

export type CrearVentaInput = {
  clienteId: number;
  canalVenta: CanalVenta;
  medioPago: string;
  costoEnvio?: number;
  facturado?: boolean;
  esVentaInterna?: boolean;
  numeroFactura?: string | null;
  tiendanubeOrderId?: number | null;
  fechaVenta?: Date;
  fechaAcreditacion?: Date | null;
  usuarioId: number;
  vendidoPorId?: number | null;
  cobradoPorId?: number | null;
  items: ItemVentaInput[];
  costos?: CostoVentaInput[];
};

export function calcularMontoCosto(
  costo: { esPorcentaje: boolean; valor: number; incluyeEnvio: boolean },
  subtotalProductos: number,
  costoEnvio: number
) {
  const base = subtotalProductos + (costo.incluyeEnvio ? costoEnvio : 0);
  return costo.esPorcentaje ? (base * costo.valor) / 100 : costo.valor;
}

async function ejecutarCrearVenta(tx: Prisma.TransactionClient, input: CrearVentaInput) {
  const costoEnvio = input.costoEnvio ?? 0;
  const facturado = input.facturado ?? false;
  const numeroFactura = input.numeroFactura ?? null;
  const fechaVenta = input.fechaVenta ?? new Date();
  const costos = input.costos ?? [];

  const subtotalProductos = input.items.reduce(
    (acc, it) => acc + it.cantidad * it.precioVentaUnitario * (1 - (it.descuentoPorcentaje ?? 0) / 100),
    0
  );

  const productosCosto = await tx.producto.findMany({
    where: { id: { in: input.items.map((i) => i.productoId) } },
    select: { id: true, precioCostoUnitario: true },
  });
  const preciosCosto = new Map(productosCosto.map((p) => [p.id, p.precioCostoUnitario]));

  // Se compra a demanda: se permite vender sin stock cargado todavía y que
  // stockActual quede en negativo hasta que se registre la compra que lo cubra.
  for (const item of input.items) {
    if (item.detalleConsignacionId) {
      const detalle = await tx.detalleConsignacion.findUniqueOrThrow({
        where: { id: item.detalleConsignacionId },
        include: { producto: true },
      });
      const disponible = detalle.cantidad - detalle.cantidadVendida;
      if (item.cantidad > disponible) {
        throw new Error(
          `Solo hay ${disponible} unidades disponibles de "${detalle.producto?.nombre ?? "producto"}" en esa consignación.`
        );
      }
    }
  }

  const venta = await tx.venta.create({
    data: {
      clienteId: input.clienteId,
      canalVenta: input.canalVenta,
      medioPago: input.medioPago,
      costoEnvio,
      facturado,
      esVentaInterna: input.esVentaInterna ?? false,
      numeroFactura,
      fechaVenta,
      fechaAcreditacion: input.fechaAcreditacion ?? null,
      vendidoPorId: input.vendidoPorId ?? null,
      cobradoPorId: input.cobradoPorId ?? null,
      usuarioId: input.usuarioId,
      tiendanubeOrderId: input.tiendanubeOrderId ?? null,
      detalles: {
        create: input.items.map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioVentaUnitario: item.precioVentaUnitario,
          descuentoPorcentaje: item.descuentoPorcentaje ?? 0,
          precioCostoUnitario: preciosCosto.get(item.productoId),
        })),
      },
    },
    include: { cliente: true, detalles: true },
  });

  const productosStockNegativo: { productoId: number; nombre: string; stockActual: number; faltante: number }[] = [];

  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    const detalleVenta = venta.detalles[i];

    const productoAntes = await tx.producto.findUniqueOrThrow({
      where: { id: item.productoId },
      select: { stockActual: true },
    });

    const productoActualizado = await tx.producto.update({
      where: { id: item.productoId },
      data: { stockActual: { decrement: item.cantidad } },
    });

    if (productoActualizado.stockActual < 0) {
      // Solo cuenta como "faltante nuevo" la parte del déficit generada por esta
      // venta; si el stock ya venía negativo, ese arrastre ya debería estar
      // cubierto por un pendiente de compra anterior (evita doble conteo).
      const faltante = Math.min(item.cantidad, Math.abs(productoActualizado.stockActual));
      if (productoAntes.stockActual >= 0) {
        productosStockNegativo.push({
          productoId: productoActualizado.id,
          nombre: productoActualizado.nombre,
          stockActual: productoActualizado.stockActual,
          faltante,
        });
      }
    }

    if (item.detalleConsignacionId) {
      await tx.ventaConsignacion.create({
        data: {
          detalleConsignacionId: item.detalleConsignacionId,
          cantidad: item.cantidad,
          precioVentaReal: item.precioVentaUnitario,
          facturado,
          numeroFactura,
          fecha: fechaVenta,
          detalleVentaId: detalleVenta.id,
        },
      });
      await tx.detalleConsignacion.update({
        where: { id: item.detalleConsignacionId },
        data: { cantidadVendida: { increment: item.cantidad } },
      });
    }
  }

  for (const costo of costos) {
    const montoCalculado = calcularMontoCosto(costo, subtotalProductos, costoEnvio);
    await tx.costoVenta.create({
      data: {
        ventaId: venta.id,
        concepto: costo.concepto,
        esPorcentaje: costo.esPorcentaje,
        valor: costo.valor,
        incluyeEnvio: costo.incluyeEnvio,
        montoCalculado,
      },
    });
  }

  await registrarLog(tx, {
    usuarioId: input.usuarioId,
    accion: "CREAR",
    entidad: "VENTA",
    entidadId: venta.id,
    detalle: `Venta a ${venta.cliente.nombre} ${venta.cliente.apellido}`,
  });

  return { ventaId: venta.id, productosStockNegativo };
}

export async function crearVentaCore(input: CrearVentaInput, tx?: Prisma.TransactionClient) {
  if (input.items.length === 0) throw new Error("Agregá al menos un producto.");

  if (tx) return ejecutarCrearVenta(tx, input);
  return prisma.$transaction((t) => ejecutarCrearVenta(t, input));
}

async function ejecutarEliminarVenta(tx: Prisma.TransactionClient, ventaId: number, usuarioId: number) {
  const venta = await tx.venta.findUniqueOrThrow({ where: { id: ventaId }, include: { cliente: true } });
  const detalles = await tx.detalleVenta.findMany({
    where: { ventaId },
    include: { ventaConsignacion: true },
  });

  for (const d of detalles) {
    if (d.ventaConsignacion) {
      if (d.ventaConsignacion.liquidacionId) {
        throw new Error("No se puede eliminar: esta venta ya fue liquidada con el socio.");
      }
      await tx.detalleConsignacion.update({
        where: { id: d.ventaConsignacion.detalleConsignacionId },
        data: { cantidadVendida: { decrement: d.ventaConsignacion.cantidad } },
      });
      await tx.ventaConsignacion.delete({ where: { id: d.ventaConsignacion.id } });
    }
    await tx.producto.update({
      where: { id: d.productoId },
      data: { stockActual: { increment: d.cantidad } },
    });
  }

  await tx.venta.delete({ where: { id: ventaId } });

  await registrarLog(tx, {
    usuarioId,
    accion: "ELIMINAR",
    entidad: "VENTA",
    entidadId: ventaId,
    detalle: `Venta a ${venta.cliente.nombre} ${venta.cliente.apellido}`,
  });

  return { clienteNombre: `${venta.cliente.nombre} ${venta.cliente.apellido}` };
}

export async function eliminarVentaCore(ventaId: number, usuarioId: number, tx?: Prisma.TransactionClient) {
  if (tx) return ejecutarEliminarVenta(tx, ventaId, usuarioId);
  return prisma.$transaction((t) => ejecutarEliminarVenta(t, ventaId, usuarioId));
}
