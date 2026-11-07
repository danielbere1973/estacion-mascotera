import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { listarSeguimientosActivos } from "./actions";
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
    listarSeguimientosActivos(),
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
