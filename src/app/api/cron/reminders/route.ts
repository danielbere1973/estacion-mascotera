import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ejecutarEnvioReminders } from "@/lib/reminders";

// Envío automático diario de reminders (vercel.json, 13:00 UTC = 10:00 Argentina).
// Misma lógica que el botón "Enviar reminders"; no repite un reminder al mismo cliente antes de 30 días.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Switch "Reminder Automático" en Off (si nunca se tocó, está en On).
  const config = await prisma.configReminders.findUnique({ where: { id: 1 }, select: { envioAutomatico: true } });
  if (config && !config.envioAutomatico) {
    return NextResponse.json({ omitido: "Reminder Automático en Off" });
  }

  const resultado = await ejecutarEnvioReminders(null);
  revalidatePath("/marketing/reminders");

  return NextResponse.json(resultado);
}
