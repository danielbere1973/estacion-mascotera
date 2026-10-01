"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { StatusReminder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

const COOKIE_SWITCH_STATUS = "reminders-switch-status";

// Los reminders se configuran por mascota, o por cliente cuando no tiene mascotas.
export type DestinoReminder = "mascota" | "cliente";

async function actualizarReminder(
  destino: DestinoReminder,
  id: number,
  data: { setupReminderDias?: number; statusReminder?: StatusReminder },
) {
  if (destino === "mascota") await prisma.mascota.update({ where: { id }, data });
  else if (destino === "cliente") await prisma.cliente.update({ where: { id }, data });
  revalidatePath("/marketing/reminders");
}

export async function actualizarSetupReminder(destino: DestinoReminder, id: number, dias: string) {
  await requireAdmin();
  // Obligatorio y mínimo 1 día.
  const n = Number.parseInt(dias, 10);
  if (!Number.isFinite(n) || n < 1) return;
  await actualizarReminder(destino, id, { setupReminderDias: n });
}

export async function actualizarStatusReminder(destino: DestinoReminder, id: number, status: string) {
  await requireAdmin();
  if (!Object.values(StatusReminder).includes(status as StatusReminder)) return;
  await actualizarReminder(destino, id, { statusReminder: status as StatusReminder });
}

export async function actualizarStatusReminderTodos(status: string) {
  await requireAdmin();
  if (!Object.values(StatusReminder).includes(status as StatusReminder)) return;
  const data = { statusReminder: status as StatusReminder };
  await prisma.$transaction([prisma.mascota.updateMany({ data }), prisma.cliente.updateMany({ data })]);
  // Se recuerda el último clic para que el botón no cambie con los cambios manuales de Status.
  (await cookies()).set(COOKIE_SWITCH_STATUS, status, { maxAge: 60 * 60 * 24 * 365 * 5, path: "/marketing/reminders" });
  revalidatePath("/marketing/reminders");
}
