import crypto from "crypto";

export async function sendTelegramMessage(text: string, chatId?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = chatId ?? process.env.TELEGRAM_CHAT_ID;

  if (!token || !chat) {
    console.error("Telegram: falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID, no se envía el mensaje.");
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML" }),
    });

    if (!res.ok) {
      console.error(`Telegram: error enviando mensaje (${res.status}): ${await res.text()}`);
    }
  } catch (error) {
    console.error("Telegram: excepción enviando mensaje", error);
  }
}

// Punto de extensión para fase 2 (comandos entrantes / aprobación de diffs desde Telegram).
export function verificarSecretoTelegram(secretHeader: string | null): boolean {
  if (!secretHeader) return false;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const esperado = Buffer.from(secret);
  const recibido = Buffer.from(secretHeader);
  if (esperado.length === 0 || esperado.length !== recibido.length) return false;
  return crypto.timingSafeEqual(esperado, recibido);
}
