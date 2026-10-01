"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

const diaArgentina = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

// Borra los eventos de los últimos `dias` días calendario (hora Argentina), contando hoy como el día 1.
export async function depurarLogs(dias: number): Promise<{ borrados?: number; error?: string }> {
  const session = await requireAdmin();
  if (!Number.isInteger(dias) || dias < 1) return { error: "Ingresá una cantidad de días válida (mínimo 1)." };

  const hoy = new Date(`${diaArgentina.format(new Date())}T00:00:00.000-03:00`);
  const desde = new Date(hoy.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
  const { count } = await prisma.logMarketing.deleteMany({ where: { fecha: { gte: desde } } });

  // La depuración queda registrada en el propio log.
  await prisma.logMarketing.create({
    data: {
      usuarioId: Number(session.user.id),
      accion: "Depuración de logs",
      detalle: `Últimos ${dias} días: ${count} eventos borrados`,
      resultado: "OK",
    },
  });
  revalidatePath("/marketing/reminders/event-log");
  return { borrados: count };
}
