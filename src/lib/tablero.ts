import { prisma } from "@/lib/prisma";
import { COLUMNA_COMPRAR_MAYORISTA, COLUMNA_LISTA_PARA_DESPACHO } from "@/lib/compras-mayoristas";

// Mueve a "Lista para despacho" solo las tarjetas de "Comprar en Mayorista"
// cuya venta incluye algún producto comprado en este job de HYM puntual (no
// toda la columna: puede haber tarjetas ahí esperando una compra a otro
// mayorista que todavía no llegó).
export async function moverTarjetasComprMayoristaADespacho(jobId: string): Promise<number> {
  const [origen, destino] = await Promise.all([
    prisma.columnaTablero.findFirst({ where: { nombre: COLUMNA_COMPRAR_MAYORISTA } }),
    prisma.columnaTablero.findFirst({ where: { nombre: COLUMNA_LISTA_PARA_DESPACHO } }),
  ]);
  if (!origen || !destino) {
    console.error("moverTarjetasComprMayoristaADespacho: no se encontró alguna de las columnas");
    return 0;
  }

  const lineasJob = await prisma.pendienteCompraMayorista.findMany({
    where: { jobId },
    select: { productoId: true },
  });
  if (lineasJob.length === 0) return 0;
  const productoIds = [...new Set(lineasJob.map((l) => l.productoId))];

  const tarjetas = await prisma.tarjetaTablero.findMany({
    where: {
      columnaId: origen.id,
      venta: { detalles: { some: { productoId: { in: productoIds } } } },
    },
    select: { id: true },
  });
  if (tarjetas.length === 0) return 0;

  const ultima = await prisma.tarjetaTablero.findFirst({
    where: { columnaId: destino.id },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  await prisma.$transaction(
    tarjetas.map((t, index) =>
      prisma.tarjetaTablero.update({
        where: { id: t.id },
        data: { columnaId: destino.id, orden: (ultima?.orden ?? 0) + index + 1 },
      })
    )
  );

  return tarjetas.length;
}

export async function moverTarjetaCore(tarjetaId: number, columnaId: number) {
  const columnaExiste = await prisma.columnaTablero.findUnique({ where: { id: columnaId } });
  if (!columnaExiste) return;

  const ultima = await prisma.tarjetaTablero.findFirst({
    where: { columnaId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  await prisma.tarjetaTablero.update({
    where: { id: tarjetaId },
    data: { columnaId, orden: (ultima?.orden ?? 0) + 1 },
  });
}
