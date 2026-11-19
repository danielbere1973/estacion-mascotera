"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

// Guarda el auto y el costo por km de un conductor (Logística > Costos/KM, solo Administradores).
export async function guardarVehiculo(formData: FormData) {
  await requireAdmin("LOGISTICA");
  const usuarioId = Number(formData.get("usuarioId"));
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) throw new Error("Usuario inválido.");
  const costoPorKm = Number(String(formData.get("costoPorKm") ?? "").replace(",", "."));
  if (!Number.isFinite(costoPorKm) || costoPorKm < 0) throw new Error("Costo por km inválido.");
  const auto = formData.get("auto")?.toString().trim() || null;

  await prisma.vehiculoUsuario.upsert({
    where: { usuarioId },
    update: { costoPorKm, auto },
    create: { usuarioId, costoPorKm, auto },
  });
  revalidatePath("/logistica/costos-km");
}
