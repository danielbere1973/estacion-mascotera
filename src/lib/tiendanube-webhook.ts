import crypto from "crypto";

export function verificarFirmaTiendanube(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;
  const secret = process.env.TIENDANUBE_CLIENT_SECRET ?? "";
  const firmaEsperada = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const esperada = Buffer.from(firmaEsperada);
  const recibida = Buffer.from(hmacHeader);
  if (esperada.length !== recibida.length) return false;
  return crypto.timingSafeEqual(esperada, recibida);
}
