"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

// Guarda la fecha a las 12:00 UTC para que no se corra de día al mostrarla
// en cualquier zona horaria.
function parseFecha(valor: string): Date | null {
  return valor ? new Date(`${valor}T12:00:00Z`) : null;
}

export async function actualizarSetupReminder(mascotaId: number, dias: string) {
  await requireAdmin();
  const n = dias.trim() === "" ? null : Number.parseInt(dias, 10);
  if (n !== null && (!Number.isFinite(n) || n < 0)) return;
  await prisma.mascota.update({ where: { id: mascotaId }, data: { setupReminderDias: n } });
  revalidatePath("/marketing/reminders");
}

export async function actualizarUltimoReminder(mascotaId: number, fecha: string) {
  await requireAdmin();
  await prisma.mascota.update({ where: { id: mascotaId }, data: { ultimoReminder: parseFecha(fecha) } });
  revalidatePath("/marketing/reminders");
}
