import { prisma } from "@/lib/prisma";
import { KanbanBoard } from "./kanban-board";

export default async function TableroControlPage() {
  const tarjetas = await prisma.tarjetaTablero.findMany({
    orderBy: { orden: "asc" },
    select: { id: true, titulo: true, notas: true, estado: true },
  });

  return <KanbanBoard tarjetas={tarjetas} />;
}
