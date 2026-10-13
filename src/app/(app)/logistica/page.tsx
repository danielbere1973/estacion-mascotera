import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { LogisticaPanel } from "./logistica-panel";

export default async function LogisticaPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;
  // Para armar el link absoluto que se manda por WhatsApp.
  const h = await headers();
  const origen = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  const [clientes, activos] = await Promise.all([
    prisma.cliente.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, apellido: true, telefono: true },
    }),
    prisma.seguimientoUbicacion.findMany({
      where: { finalizadoAt: null, venceAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        usuarioId: true,
        latitud: true,
        longitud: true,
        precision: true,
        ubicacionAt: true,
        venceAt: true,
        cliente: { select: { nombre: true, apellido: true, telefono: true } },
        usuario: { select: { nombre: true, apellido: true } },
      },
    }),
  ]);

  return (
    <LogisticaPanel
      clientes={clientes}
      activos={activos}
      usuarioId={Number(session.user.id)}
      clienteIdInicial={params.clienteId ?? ""}
      origen={origen}
    />
  );
}
