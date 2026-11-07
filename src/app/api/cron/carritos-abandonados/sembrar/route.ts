import { NextRequest, NextResponse } from "next/server";
import { sembrarCarritosAbandonadosExistentes } from "@/lib/carritos-abandonados";

// Endpoint de uso único: marca los carritos abandonados actuales como ya vistos,
// para que el cron de /api/cron/carritos-abandonados no los notifique retroactivamente.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultado = await sembrarCarritosAbandonadosExistentes();

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 502 });
  }

  return NextResponse.json(resultado);
}
