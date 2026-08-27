import crypto from "crypto";

export type BotonInline = { text: string; callback_data: string };

export async function sendTelegramMessage(
  text: string,
  opts?: { chatId?: string; botones?: BotonInline[][] }
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatsEnv = [
    process.env.TELEGRAM_CHAT_ID,
    process.env.TELEGRAM_CHAT_ID_2,
    process.env.TELEGRAM_CHAT_ID_3,
  ]
    .filter(Boolean)
    .join(",");
  const chats = opts?.chatId
    ? [opts.chatId]
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
          body: JSON.stringify({
            chat_id: chat,
            text,
            parse_mode: "HTML",
            ...(opts?.botones ? { reply_markup: { inline_keyboard: opts.botones } } : {}),
          }),
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

export async function answerCallbackQuery(callbackQueryId: string, texto?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("Telegram: falta TELEGRAM_BOT_TOKEN, no se responde el callback_query.");
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        ...(texto ? { text: texto } : {}),
      }),
    });

    if (!res.ok) {
      console.error(`Telegram: error en answerCallbackQuery (${res.status}): ${await res.text()}`);
    }
  } catch (error) {
    console.error("Telegram: excepción en answerCallbackQuery", error);
  }
}

export function esChatAutorizado(chatId: string): boolean {
  const autorizados = [process.env.TELEGRAM_CHAT_ID, process.env.TELEGRAM_CHAT_ID_2]
    .filter((id): id is string => Boolean(id))
    .flatMap((id) => id.split(","))
    .map((id) => id.trim())
    .filter(Boolean);
  return autorizados.includes(chatId);
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
