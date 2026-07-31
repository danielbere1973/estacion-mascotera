/**
 * One-off: elimina filas duplicadas de historialStockMayorista.
 * Para cada (proveedorId, sku), conserva la fila con productoId si existe,
 * o la más reciente por fechaImportacion. Elimina el resto.
 *
 * Ejecutar: npx ts-node scripts/dedup-historial-mayorista.ts
 * Para preview sin borrar: npx ts-node scripts/dedup-historial-mayorista.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const grupos = await prisma.$queryRaw<{ proveedorId: number; sku: string; cnt: number }[]>`
    SELECT "proveedorId", sku, COUNT(*)::int as cnt
    FROM "HistorialStockMayorista"
    GROUP BY "proveedorId", sku
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
  `;

  console.log(`Grupos con duplicados: ${grupos.length}`);
  if (grupos.length === 0) {
    console.log("No hay duplicados. Nada que hacer.");
    return;
  }

  let totalEliminados = 0;

  for (const grupo of grupos) {
    const filas = await prisma.historialStockMayorista.findMany({
      where: { proveedorId: grupo.proveedorId, sku: grupo.sku },
      orderBy: [
        { productoId: "desc" },       // primero las que tienen productoId
        { fechaImportacion: "desc" }, // luego las más recientes
      ],
    });

    // La primera es la que conservamos
    const [conservar, ...eliminar] = filas;
    const idsEliminar = eliminar.map((f) => f.id);

    console.log(
      `proveedorId=${grupo.proveedorId} sku=${grupo.sku}: conservar id=${conservar.id} (productoId=${conservar.productoId}), eliminar ${idsEliminar.length} filas`
    );

    if (!dryRun && idsEliminar.length > 0) {
      await prisma.historialStockMayorista.deleteMany({
        where: { id: { in: idsEliminar } },
      });
      totalEliminados += idsEliminar.length;
    }
  }

  if (dryRun) {
    console.log("\n[DRY RUN] No se eliminó nada. Correr sin --dry-run para aplicar.");
  } else {
    console.log(`\nListo: ${totalEliminados} filas eliminadas.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
