import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estadoSeguimiento } from "@/lib/seguimiento";

// Público (sin login, excluido en middleware.ts): lo consulta la página
// /seguimiento/<token> que abre el cliente. Solo expone la posición mientras
// el seguimiento está activo.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await prisma.seguimientoUbicacion.findUnique({
    where: { token },
    select: {
      latitud: true,
      longitud: true,
      precision: true,
      ubicacionAt: true,
      venceAt: true,
      finalizadoAt: true,
    },
  });
  if (!s) return NextResponse.json({ estado: "NO_ENCONTRADO" }, { status: 404 });

  const estado = estadoSeguimiento(s);
  const datos =
    estado === "ACTIVO"
      ? { latitud: s.latitud, longitud: s.longitud, precision: s.precision, ubicacionAt: s.ubicacionAt }
      : {};
  return NextResponse.json(
    { estado, venceAt: s.venceAt, ...datos },
    { headers: { "Cache-Control": "no-store" } }
  );
}
