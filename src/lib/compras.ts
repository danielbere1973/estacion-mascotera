import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarLog } from "@/lib/log";

export type CrearCompraInput = {
  proveedorId: number;
  productoId: number;
  cantidad: number;
  precioCostoUnitario: number;
  usuarioId: number;
  numeroPedido?: string | null;
  descuentoPorcentaje?: number;
  costoEnvio?: number;
  facturado?: boolean;
  numeroFactura?: string | null;
  pagadoPorId?: number | null;
  fechaCompra?: Date;
};

async function ejecutarCrearCompra(tx: Prisma.TransactionClient, input: CrearCompraInput) {
  const producto = await tx.producto.findUniqueOrThrow({ where: { id: input.productoId } });
  const precioVenta = input.precioCostoUnitario * (1 + Number(producto.margenPorcentaje) / 100);

  await tx.producto.update({
    where: { id: input.productoId },
    data: {
      precioCostoUnitario: input.precioCostoUnitario,
      precioVenta,
      stockActual: { increment: input.cantidad },
    },
  });

  const compra = await tx.compra.create({
    data: {
      proveedorId: input.proveedorId,
      productoId: input.productoId,
      cantidad: input.cantidad,
      precioCostoUnitario: input.precioCostoUnitario,
      numeroPedido: input.numeroPedido ?? null,
      descuentoPorcentaje: input.descuentoPorcentaje ?? 0,
      costoEnvio: input.costoEnvio ?? 0,
      facturado: input.facturado ?? false,
      numeroFactura: input.numeroFactura ?? null,
      pagadoPorId: input.pagadoPorId ?? null,
      fechaCompra: input.fechaCompra ?? new Date(),
      usuarioId: input.usuarioId,
    },
    include: { producto: true, proveedor: true },
  });

  await registrarLog(tx, {
    usuarioId: input.usuarioId,
    accion: "CREAR",
    entidad: "COMPRA",
    entidadId: compra.id,
    detalle: `${compra.producto.nombre} x${compra.cantidad} - ${compra.proveedor.nombre}`,
  });

  return { compraId: compra.id };
}

export async function crearCompraCore(input: CrearCompraInput, tx?: Prisma.TransactionClient) {
  if (tx) return ejecutarCrearCompra(tx, input);
  return prisma.$transaction((t) => ejecutarCrearCompra(t, input));
}
