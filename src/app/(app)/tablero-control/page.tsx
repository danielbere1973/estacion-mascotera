import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { KanbanBoard } from "./kanban-board";
import { COLUMNAS_INICIALES, PALETA_COLORES } from "./columnas";

function esViolacionDeUnicidad(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function getOCrearColumnas() {
  const existentes = await prisma.columnaTablero.count();
  if (existentes === 0) {
    try {
      await prisma.columnaTablero.createMany({
        data: COLUMNAS_INICIALES.map((nombre, i) => ({
          nombre,
          orden: i,
          color: PALETA_COLORES[i % PALETA_COLORES.length],
        })),
      });
    } catch (error) {
      // Otra request concurrente ya sembró las columnas primero (choque contra
      // el @@unique([orden])) — no es un error real, solo evita duplicarlas.
      if (!esViolacionDeUnicidad(error)) throw error;
    }
  }
  return prisma.columnaTablero.findMany({ orderBy: { orden: "asc" } });
}

export default async function TableroControlPage() {
  const columnas = await getOCrearColumnas();
  const tarjetas = await prisma.tarjetaTablero.findMany({
    orderBy: { orden: "asc" },
    select: { id: true, titulo: true, notas: true, columnaId: true },
  });

  return <KanbanBoard columnas={columnas} tarjetas={tarjetas} />;
}
