import crypto from "crypto";

export async function sendTelegramMessage(text: string, chatId?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatsEnv = [
    process.env.TELEGRAM_CHAT_ID,
    process.env.TELEGRAM_CHAT_ID_2,
    process.env.TELEGRAM_CHAT_ID_3,
  ]
    .filter(Boolean)
    .join(",");
  const chats = chatId
    ? [chatId]
    : chatsEnv.split(",").map((c) => c.trim()).filter(Boolean);

  if (!token || chats.length === 0) {
    console.error("Telegram: falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID, no se envía el mensaje.");
    return;
  }

  await Promise.all(
    chats.map(async (chat) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML" }),
        });

        if (!res.ok) {
          console.error(`Telegram: error enviando mensaje a ${chat} (${res.status}): ${await res.text()}`);
        }
      } catch (error) {
        console.error(`Telegram: excepción enviando mensaje a ${chat}`, error);
      }
    })
  );
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
