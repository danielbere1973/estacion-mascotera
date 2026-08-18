import { NextRequest, NextResponse } from "next/server";
import { verificarFirmaTiendanube } from "@/lib/tiendanube-webhook";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-linkedstore-hmac-sha256");

  if (!verificarFirmaTiendanube(rawBody, hmac)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  // No almacenamos datos de clientes de Tiendanube: solo el token de la tienda.
  return NextResponse.json({ ok: true });
}
