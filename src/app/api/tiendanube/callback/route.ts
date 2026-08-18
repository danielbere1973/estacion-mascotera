import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Falta el parámetro code" }, { status: 400 });
  }

  try {
    const res = await fetch("https://www.tiendanube.com/apps/authorize/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.TIENDANUBE_CLIENT_ID,
        client_secret: process.env.TIENDANUBE_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
      }),
    });

    if (!res.ok) {
      const detalle = await res.text();
      return NextResponse.json({ error: "No se pudo obtener el token", detalle }, { status: 502 });
    }

    const data = (await res.json()) as { access_token: string; user_id: number; scope: string };

    await prisma.tiendanubeConfig.upsert({
      where: { storeId: String(data.user_id) },
      create: {
        storeId: String(data.user_id),
        accessToken: data.access_token,
        scope: data.scope,
      },
      update: {
        accessToken: data.access_token,
        scope: data.scope,
      },
    });

    return NextResponse.json({ ok: true, storeId: data.user_id });
  } catch (err) {
    return NextResponse.json(
      { error: "Excepción en el callback", detalle: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
