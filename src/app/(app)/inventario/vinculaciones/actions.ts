"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function desvincularItem(formData: FormData) {
  await requireAdmin();
  const historialId = Number(formData.get("historialId"));
  if (!historialId) throw new Error("Datos inválidos.");

  const item = await prisma.historialStockMayorista.findUnique({
    where: { id: historialId },
    select: { productoId: true },
  });
  if (!item?.productoId) throw new Error("Este ítem ya no tiene vinculación.");

  // Verificar que el producto tenga al menos otro proveedor vinculado
  const otrosVinculos = await prisma.historialStockMayorista.count({
    where: {
      productoId: item.productoId,
      id: { not: historialId },
      activo: true,
    },
  });

  if (otrosVinculos === 0) {
    throw new Error(
      "No se puede desvincular: es el único proveedor de este producto. Primero vinculá otro proveedor o dá de baja el producto."
    );
  }

  await prisma.historialStockMayorista.update({
    where: { id: historialId },
    data: { productoId: null },
  });

  revalidatePath("/inventario/vinculaciones");
}
