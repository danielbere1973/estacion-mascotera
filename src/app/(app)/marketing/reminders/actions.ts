"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function actualizarSetupReminder(mascotaId: number, dias: string) {
  await requireAdmin();
  const n = dias.trim() === "" ? null : Number.parseInt(dias, 10);
  if (n !== null && (!Number.isFinite(n) || n < 0)) return;
  await prisma.mascota.update({ where: { id: mascotaId }, data: { setupReminderDias: n } });
  revalidatePath("/marketing/reminders");
}
