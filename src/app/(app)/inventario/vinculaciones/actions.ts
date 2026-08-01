"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function desvincularItem(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  await requireAdmin();
  const historialId = Number(formData.get("historialId"));
  if (!historialId) return { error: "Datos inválidos." };

  const item = await prisma.historialStockMayorista.findUnique({
    where: { id: historialId },
    select: { productoId: true },
  });
  if (!item?.productoId) return { error: "Este ítem ya no tiene vinculación." };

  const otrosVinculos = await prisma.historialStockMayorista.count({
    where: {
      productoId: item.productoId,
      id: { not: historialId },
      activo: true,
    },
  });

  if (otrosVinculos === 0) {
    return {
      error: "Es el único proveedor de este producto. Vinculá otro proveedor antes de desvincular este.",
    };
  }

  await prisma.historialStockMayorista.update({
    where: { id: historialId },
    data: { productoId: null },
  });

  revalidatePath("/inventario/vinculaciones");
  return { error: null };
}
