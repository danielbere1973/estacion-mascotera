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

    if (!data.access_token || !data.user_id) {
      const clientId = process.env.TIENDANUBE_CLIENT_ID ?? "";
      const clientSecret = process.env.TIENDANUBE_CLIENT_SECRET ?? "";
      return NextResponse.json(
        {
          error: "Respuesta inesperada de Tiendanube",
          data,
          debug: {
            clientIdLen: clientId.length,
            clientIdLast4: clientId.slice(-4),
            clientSecretLen: clientSecret.length,
            clientSecretLast4: clientSecret.slice(-4),
          },
        },
        { status: 502 },
      );
    }

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
