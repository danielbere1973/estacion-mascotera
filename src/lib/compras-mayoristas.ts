import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const HYM_PROVEEDOR_ID = 5;
export const COLUMNA_INGRESO_ORDEN = "Ingreso de Orden - Pendiente";
export const COLUMNA_COMPRAR_MAYORISTA = "Comprar en Mayorista";
export const COLUMNA_LISTA_PARA_DESPACHO = "Lista para despacho";

// Resuelve una línea PendienteCompraMayorista que HYM marcó "sin stock":
// si Daniel/Pablo confirman por WhatsApp que sí hay stock real, vuelve a
// PENDIENTE para que el próximo corte la reintente; si confirman que no
// hay stock, pasa a FALLIDO y no se vuelve a procesar automáticamente.
export async function resolverPendienteSinStock(pendienteId: number, hayStockReal: boolean) {
  if (hayStockReal) {
    await prisma.pendienteCompraMayorista.update({
      where: { id: pendienteId },
      data: { estado: "PENDIENTE", errorMotivo: null, jobId: null },
    });
  } else {
    await prisma.pendienteCompraMayorista.update({
      where: { id: pendienteId },
      data: { estado: "FALLIDO" },
    });
  }
}

// Mueve la tarjeta de una venta a "Comprar en Mayorista", o si la venta
// todavía no tiene tarjeta (ej. venta manual, que no crea tarjetas), crea una
// directamente en esa columna.
export async function moverOCrearTarjetaCompraMayorista(
  tx: Prisma.TransactionClient,
  params: { ventaId: number; clienteId: number; titulo: string }
) {
  const columna = await tx.columnaTablero.findFirst({ where: { nombre: COLUMNA_COMPRAR_MAYORISTA } });
  if (!columna) {
    console.error(`moverOCrearTarjetaCompraMayorista: no se encontró la columna "${COLUMNA_COMPRAR_MAYORISTA}"`);
    return;
  }

  const ultima = await tx.tarjetaTablero.findFirst({
    where: { columnaId: columna.id },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  const orden = (ultima?.orden ?? 0) + 1;

  const tarjetaExistente = await tx.tarjetaTablero.findFirst({ where: { ventaId: params.ventaId } });

  if (tarjetaExistente) {
    await tx.tarjetaTablero.update({
      where: { id: tarjetaExistente.id },
      data: { columnaId: columna.id, orden },
    });
  } else {
    await tx.tarjetaTablero.create({
      data: {
        titulo: params.titulo,
        columnaId: columna.id,
        ventaId: params.ventaId,
        clienteId: params.clienteId,
        orden,
      },
    });
  }
}

// Crea la tarjeta de seguimiento de una venta que no disparó compra a
// mayorista (stock suficiente, o stock negativo sin proveedor mapeado):
// entra directo a la primera columna del tablero para que quede visible
// igual que cualquier otro pedido.
export async function crearTarjetaIngresoOrden(
  tx: Prisma.TransactionClient,
  params: { ventaId: number; clienteId: number; titulo: string }
) {
  const columna = await tx.columnaTablero.findFirst({ where: { nombre: COLUMNA_INGRESO_ORDEN } });
  if (!columna) {
    console.error(`crearTarjetaIngresoOrden: no se encontró la columna "${COLUMNA_INGRESO_ORDEN}"`);
    return;
  }

  const ultima = await tx.tarjetaTablero.findFirst({
    where: { columnaId: columna.id },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  await tx.tarjetaTablero.create({
    data: {
      titulo: params.titulo,
      columnaId: columna.id,
      ventaId: params.ventaId,
      clienteId: params.clienteId,
      orden: (ultima?.orden ?? 0) + 1,
    },
  });
}

// Por cada producto que quedó con stock negativo, acumula (o crea) una línea
// PENDIENTE en PendienteCompraMayorista. `huboPendienteHym` indica si se generó
// al menos un pendiente con mapeo HYM (para que el caller decida si mueve/crea
// la tarjeta del Tablero en la columna "Comprar en Mayorista"). `sinMapeoHym`
// lista los productos que quedaron negativos pero no tienen mapeo HYM activo
// (otro proveedor, o venta fuera de Tiendanube de un producto con poco stock)
// para que el caller avise que la reposición sigue siendo manual.
export async function registrarPendientesCompra(
  tx: Prisma.TransactionClient,
  productosStockNegativo: { productoId: number; nombre: string; faltante: number }[]
): Promise<{ huboPendienteHym: boolean; sinMapeoHym: string[] }> {
  let huboPendienteHym = false;
  const sinMapeoHym: string[] = [];

  for (const producto of productosStockNegativo) {
    const mapeoHym = await tx.historialStockMayorista.findFirst({
      where: { productoId: producto.productoId, proveedorId: HYM_PROVEEDOR_ID, activo: true },
      select: { id: true },
    });

    if (!mapeoHym) {
      console.error(
        `registrarPendientesCompra: "${producto.nombre}" sin mapeo HYM activo, no se genera pendiente automático`
      );
      sinMapeoHym.push(producto.nombre);
      continue;
    }

    huboPendienteHym = true;

    const pendienteExistente = await tx.pendienteCompraMayorista.findFirst({
      where: { productoId: producto.productoId, proveedorId: HYM_PROVEEDOR_ID, estado: "PENDIENTE" },
    });

    if (pendienteExistente) {
      await tx.pendienteCompraMayorista.update({
        where: { id: pendienteExistente.id },
        data: { cantidad: { increment: producto.faltante } },
      });
    } else {
      await tx.pendienteCompraMayorista.create({
        data: {
          productoId: producto.productoId,
          proveedorId: HYM_PROVEEDOR_ID,
          cantidad: producto.faltante,
        },
      });
    }
  }

  return { huboPendienteHym, sinMapeoHym };
}
