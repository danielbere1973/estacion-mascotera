import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ejecutarEnvioReminders } from "@/lib/reminders";

// Envío automático diario de reminders (vercel.json, 13:00 UTC = 10:00 Argentina).
// Misma lógica que el botón "Enviar reminders"; no reenvía a quien ya lo recibió desde su última compra.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultado = await ejecutarEnvioReminders(null);
  revalidatePath("/marketing/reminders");

  return NextResponse.json(resultado);
}
