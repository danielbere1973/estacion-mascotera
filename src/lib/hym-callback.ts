import crypto from "crypto";

function tokenValido(tokenHeader: string | null, secret: string | undefined): boolean {
  if (!tokenHeader) return false;
  const esperado = Buffer.from(secret ?? "");
  const recibido = Buffer.from(tokenHeader);
  if (esperado.length === 0 || esperado.length !== recibido.length) return false;
  return crypto.timingSafeEqual(esperado, recibido);
}

export function verificarTokenCallbackHym(tokenHeader: string | null): boolean {
  return tokenValido(tokenHeader, process.env.HYM_CALLBACK_TOKEN);
}

export function verificarTokenSyncHym(tokenHeader: string | null): boolean {
  return tokenValido(tokenHeader, process.env.HYM_SYNC_TOKEN);
}
