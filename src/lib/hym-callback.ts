import crypto from "crypto";

export function verificarTokenCallbackHym(tokenHeader: string | null): boolean {
  if (!tokenHeader) return false;
  const secret = process.env.HYM_CALLBACK_TOKEN ?? "";
  const esperado = Buffer.from(secret);
  const recibido = Buffer.from(tokenHeader);
  if (esperado.length === 0 || esperado.length !== recibido.length) return false;
  return crypto.timingSafeEqual(esperado, recibido);
}
