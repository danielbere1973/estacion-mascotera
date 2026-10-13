import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { estadoSeguimiento } from "@/lib/seguimiento";
import { VistaSeguimiento } from "./vista-seguimiento";

export const metadata: Metadata = {
  title: "Ubicación en vivo · Estación Mascotera",
  robots: { index: false, follow: false },
};

// Página pública (sin login, excluida en middleware.ts) que abre el cliente
// desde el link de WhatsApp.
export default async function SeguimientoPage({ params }: { params: Promise<{ token: string }> }) {
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
  if (!s) notFound();

  const estado = estadoSeguimiento(s);
  return (
    <VistaSeguimiento
      token={token}
      inicial={
        estado === "ACTIVO"
          ? {
              estado,
              latitud: s.latitud,
              longitud: s.longitud,
              precision: s.precision,
              ubicacionAt: s.ubicacionAt?.toISOString() ?? null,
            }
          : { estado }
      }
    />
  );
}
