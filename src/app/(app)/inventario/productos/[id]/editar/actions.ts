"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function agregarProveedorProducto(formData: FormData) {
  await requireAdmin();

  const productoId = Number(formData.get("productoId"));
  const proveedorId = Number(formData.get("proveedorId"));
  const sku = formData.get("sku")?.toString().trim() || null;
  const precioCosto = Number(formData.get("precioCosto") || 0);

  if (!productoId || !proveedorId) throw new Error("Datos inválidos.");

  const producto = await prisma.producto.findUniqueOrThrow({ where: { id: productoId }, select: { sku: true } });
  const skuFinal = sku || producto.sku;

  await prisma.historialStockMayorista.upsert({
    where: { proveedorId_sku: { proveedorId, sku: skuFinal } },
    update: { productoId, precioCostoScraped: precioCosto, activo: true },
    create: {
      proveedorId,
      productoId,
      sku: skuFinal,
      precioCostoScraped: precioCosto,
      activo: true,
    },
  });

  // Si existe otro Producto con ese SKU, lo marcamos inactivo (queda absorbido por este)
  await prisma.producto.updateMany({
    where: { sku: skuFinal, id: { not: productoId } },
    data: { activo: false },
  });

  revalidatePath(`/inventario/productos/${productoId}/editar`);
  revalidatePath("/inventario");
}

export async function quitarProveedorProducto(formData: FormData) {
  await requireAdmin();

  const historialId = Number(formData.get("historialId"));
  const productoId = Number(formData.get("productoId"));
  if (!historialId) throw new Error("Datos inválidos.");

  await prisma.historialStockMayorista.update({
    where: { id: historialId },
    data: { productoId: null },
  });

  revalidatePath(`/inventario/productos/${productoId}/editar`);
  revalidatePath("/inventario");
}
