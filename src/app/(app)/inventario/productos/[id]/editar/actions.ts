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

  if (!sku) throw new Error("Debe ingresar el SKU del proveedor.");

  await prisma.historialStockMayorista.upsert({
    where: { proveedorId_sku: { proveedorId, sku } },
    update: { productoId, precioCostoScraped: precioCosto, activo: true },
    create: {
      proveedorId,
      productoId,
      sku,
      precioCostoScraped: precioCosto,
      activo: true,
    },
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
