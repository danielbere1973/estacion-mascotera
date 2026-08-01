"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function desvincularItem(formData: FormData) {
  await requireAdmin();
  const historialId = Number(formData.get("historialId"));
  if (!historialId) throw new Error("Datos inválidos.");

  await prisma.historialStockMayorista.update({
    where: { id: historialId },
    data: { productoId: null },
  });

  revalidatePath("/inventario/vinculaciones");
}
