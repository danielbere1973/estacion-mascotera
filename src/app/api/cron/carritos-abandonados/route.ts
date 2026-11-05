import { NextRequest, NextResponse } from "next/server";
import { revisarCarritosAbandonados } from "@/lib/carritos-abandonados";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultado = await revisarCarritosAbandonados();

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 502 });
  }

  return NextResponse.json(resultado);
}
