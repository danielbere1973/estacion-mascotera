import { NextRequest, NextResponse } from "next/server";
import { verificarFirmaTiendanube } from "@/lib/tiendanube-webhook";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-linkedstore-hmac-sha256");

  if (!verificarFirmaTiendanube(rawBody, hmac)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const { store_id } = JSON.parse(rawBody) as { store_id: number };

  await prisma.tiendanubeConfig.deleteMany({ where: { storeId: String(store_id) } });

  return NextResponse.json({ ok: true });
}
