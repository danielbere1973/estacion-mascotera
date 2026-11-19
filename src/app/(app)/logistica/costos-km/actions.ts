"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

// Guarda el costo por km de Logística > Costos/KM (solo Administradores).
export async function guardarCostoPorKm(formData: FormData) {
  await requireAdmin("LOGISTICA");
  const costoPorKm = Number(String(formData.get("costoPorKm") ?? "").replace(",", "."));
  if (!Number.isFinite(costoPorKm) || costoPorKm < 0) throw new Error("Costo por km inválido.");

  await prisma.configLogistica.upsert({
    where: { id: 1 },
    update: { costoPorKm },
    create: { id: 1, costoPorKm },
  });
  revalidatePath("/logistica/costos-km");
}
