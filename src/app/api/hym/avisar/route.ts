import { NextRequest, NextResponse } from "next/server";
import { verificarTokenSyncHym } from "@/lib/hym-callback";
import { sendTelegramMessage } from "@/lib/telegram";

// Mini-endpoint para que el servicio local (sync_precios_stock.py) pueda avisar
// por Telegram sin tener que guardar el token del bot en la PC de Daniel — solo
// reenvía texto a sendTelegramMessage, reusando el mismo token de sync HYM.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-hym-sync-token");
  if (!verificarTokenSyncHym(token)) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const body = (await req.json()) as { texto?: string };
  if (!body.texto) {
    return NextResponse.json({ error: "Falta texto" }, { status: 400 });
  }

  await sendTelegramMessage(body.texto);
  return NextResponse.json({ ok: true });
}
