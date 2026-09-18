"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

const PROVEEDOR_HYM = 5;
const RUTA = "/admin-temp-duplicados-hym";

// Reconoce sufijos de tamaño tipo "-12kg", "-0.85", "-10Kg", "-1.5lt", etc.
const SUFIJO_TAMANIO = /^(.+?)-[\d.]+\s*(kg|g|gr|gms|ml|lt|l)?$/i;

function codigoBase(sku: string): string | null {
  const m = sku.match(SUFIJO_TAMANIO);
  return m ? m[1] : null;
}

export async function listarDuplicados() {
  await requireAdmin();

  const historial = await prisma.historialStockMayorista.findMany({
    where: { proveedorId: PROVEEDOR_HYM },
    select: {
      id: true,
      sku: true,
      nombre: true,
      skuInterno: true,
      productoId: true,
      producto: { select: { id: true, skuInterno: true, nombre: true, stockActual: true } },
    },
    orderBy: { sku: "asc" },
  });

  const porSku = new Map(historial.map((h) => [h.sku, h]));
  const grupos: {
    base: (typeof historial)[number] | null;
    baseSku: string;
    duplicado: (typeof historial)[number];
  }[] = [];

  for (const h of historial) {
    const base = codigoBase(h.sku);
    if (!base || base === h.sku) continue;
    const filaBase = porSku.get(base) ?? null;
    grupos.push({ base: filaBase, baseSku: base, duplicado: h });
  }

  const productoIds = new Set<number>();
  for (const g of grupos) {
    if (g.duplicado.productoId) productoIds.add(g.duplicado.productoId);
    if (g.base?.productoId) productoIds.add(g.base.productoId);
  }

  const conteos = new Map<number, { compras: number; ventas: number; pendientes: number; consignaciones: number; dropshipping: number; recurrentes: number; recordatorios: number }>();
  for (const productoId of productoIds) {
    const [compras, ventas, pendientes, consignaciones, dropshipping, recurrentes, recordatorios] = await Promise.all([
      prisma.compra.count({ where: { productoId } }),
      prisma.detalleVenta.count({ where: { productoId } }),
      prisma.pendienteCompraMayorista.count({ where: { productoId } }),
      prisma.detalleConsignacion.count({ where: { productoId } }),
      prisma.ordenDropshipping.count({ where: { productoId } }),
      prisma.clienteProductoRecurrente.count({ where: { productoId } }),
      prisma.recordatorioReposicion.count({ where: { productoId } }),
    ]);
    conteos.set(productoId, { compras, ventas, pendientes, consignaciones, dropshipping, recurrentes, recordatorios });
  }

  return grupos.map((g) => ({
    baseSku: g.baseSku,
    base: g.base
      ? {
          historialId: g.base.id,
          sku: g.base.sku,
          productoId: g.base.productoId,
          productoNombre: g.base.producto?.nombre ?? null,
          productoSkuInterno: g.base.producto?.skuInterno ?? null,
        }
      : null,
    duplicado: {
      historialId: g.duplicado.id,
      sku: g.duplicado.sku,
      nombre: g.duplicado.nombre,
      productoId: g.duplicado.productoId,
      productoNombre: g.duplicado.producto?.nombre ?? null,
      productoSkuInterno: g.duplicado.producto?.skuInterno ?? null,
    },
    mismoProducto: g.base !== null && g.base.productoId !== null && g.base.productoId === g.duplicado.productoId,
    conteosDuplicado: g.duplicado.productoId ? conteos.get(g.duplicado.productoId) ?? null : null,
    conteosBase: g.base?.productoId ? conteos.get(g.base.productoId) ?? null : null,
  }));
}

// Limpia un par duplicado/base:
// - Si no hay fila base real, o ambos apuntan al mismo Producto (o ninguno tiene
//   Producto vinculado), no hay nada que reasignar: se borra directamente la fila
//   -Xkg de HistorialStockMayorista.
// - Si apuntan a Productos distintos, primero se reasignan TODAS las relaciones
//   (compras, ventas, pendientes, consignaciones, dropshipping, recurrentes,
//   recordatorios) del Producto duplicado al Producto base, y recién después se
//   borra la fila -Xkg y el Producto duplicado (si quedó sin ninguna otra fila
//   de historial apuntándolo).
export async function limpiarDuplicado(historialIdDuplicado: number) {
  await requireAdmin();

  const duplicado = await prisma.historialStockMayorista.findUnique({
    where: { id: historialIdDuplicado },
    select: { id: true, sku: true, proveedorId: true, productoId: true },
  });
  if (!duplicado || duplicado.proveedorId !== PROVEEDOR_HYM) {
    throw new Error("Fila no encontrada o no pertenece a HYM");
  }
  const baseSku = codigoBase(duplicado.sku);
  if (!baseSku) throw new Error("Este SKU no tiene sufijo de tamaño reconocible");

  const base = await prisma.historialStockMayorista.findUnique({
    where: { proveedorId_sku: { proveedorId: PROVEEDOR_HYM, sku: baseSku } },
    select: { id: true, productoId: true },
  });

  const productoDuplicado = duplicado.productoId;
  const productoBase = base?.productoId ?? null;

  if (productoDuplicado && productoBase && productoDuplicado !== productoBase) {
    await prisma.$transaction(async (tx) => {
      await tx.compra.updateMany({ where: { productoId: productoDuplicado }, data: { productoId: productoBase } });
      await tx.detalleVenta.updateMany({ where: { productoId: productoDuplicado }, data: { productoId: productoBase } });
      await tx.pendienteCompraMayorista.updateMany({ where: { productoId: productoDuplicado }, data: { productoId: productoBase } });
      await tx.detalleConsignacion.updateMany({ where: { productoId: productoDuplicado }, data: { productoId: productoBase } });
      await tx.ordenDropshipping.updateMany({ where: { productoId: productoDuplicado }, data: { productoId: productoBase } });
      await tx.recordatorioReposicion.updateMany({ where: { productoId: productoDuplicado }, data: { productoId: productoBase } });

      // productoCategoriaTiendanube tiene @@id([productoId, categoriaId]) y
      // onDelete: Cascade: si no la movemos antes de borrar el Producto duplicado,
      // se pierde silenciosamente la categoría asociada.
      const categoriasDuplicado = await tx.productoCategoriaTiendanube.findMany({
        where: { productoId: productoDuplicado },
        select: { categoriaId: true },
      });
      for (const cat of categoriasDuplicado) {
        await tx.productoCategoriaTiendanube.upsert({
          where: { productoId_categoriaId: { productoId: productoBase, categoriaId: cat.categoriaId } },
          create: { productoId: productoBase, categoriaId: cat.categoriaId },
          update: {},
        });
      }
      await tx.productoCategoriaTiendanube.deleteMany({ where: { productoId: productoDuplicado } });

      // clienteProductoRecurrente tiene @@unique([clienteId, productoId]): si el
      // cliente ya tiene una fila recurrente para el producto base, no se puede
      // mover la del duplicado sin violar la unicidad -> se borra la del duplicado.
      const recurrentesDuplicado = await tx.clienteProductoRecurrente.findMany({
        where: { productoId: productoDuplicado },
        select: { id: true, clienteId: true },
      });
      for (const r of recurrentesDuplicado) {
        const yaExiste = await tx.clienteProductoRecurrente.findUnique({
          where: { clienteId_productoId: { clienteId: r.clienteId, productoId: productoBase } },
        });
        if (yaExiste) {
          await tx.clienteProductoRecurrente.delete({ where: { id: r.id } });
        } else {
          await tx.clienteProductoRecurrente.update({ where: { id: r.id }, data: { productoId: productoBase } });
        }
      }

      // Cualquier otra fila de historial (de otro proveedor) que todavía apunte
      // al Producto duplicado: la desvinculamos, no la borramos.
      await tx.historialStockMayorista.updateMany({
        where: { productoId: productoDuplicado, id: { not: duplicado.id } },
        data: { productoId: null },
      });

      await tx.historialStockMayorista.delete({ where: { id: duplicado.id } });

      const quedanReferencias = await tx.historialStockMayorista.findFirst({
        where: { productoId: productoDuplicado },
      });
      if (!quedanReferencias) {
        await tx.producto.delete({ where: { id: productoDuplicado } });
      }
    });
  } else {
    // Mismo producto (o sin Producto vinculado en alguno de los dos lados):
    // no hay ventas/compras que reasignar, se borra directo la fila -Xkg.
    await prisma.historialStockMayorista.delete({ where: { id: duplicado.id } });
  }

  revalidatePath(RUTA);
}
