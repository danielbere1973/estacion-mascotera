/**
 * Limpia duplicados case-insensitive en historialStockMayorista.
 * Para cada (proveedorId, LOWER(sku)) con múltiples filas:
 * - Conserva la variante en minúsculas (o la más reciente si no hay una en minúsculas)
 * - Reasigna productoId al conservado si el eliminado lo tenía
 * - Actualiza el SKU del Producto vinculado a la variante en minúsculas
 * - Elimina la fila duplicada
 *
 * Ejecutar: npx ts-node scripts/dedup-historial-case.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const grupos = await prisma.$queryRaw<{ proveedorId: number; skuLower: string; skus: string }[]>`
    SELECT "proveedorId", LOWER(sku) as "skuLower", STRING_AGG(sku, ',' ORDER BY sku) as skus
    FROM "HistorialStockMayorista"
    GROUP BY "proveedorId", LOWER(sku)
    HAVING COUNT(*) > 1
  `;

  console.log(`Grupos duplicados (case-insensitive): ${grupos.length}`);
  let eliminados = 0;

  for (const grupo of grupos) {
    const variantes = grupo.skus.split(",");

    // Preferir la variante en minúsculas; si no hay, tomar la primera
    const skuConservar = variantes.find(v => v === v.toLowerCase()) ?? variantes[0];
    const skusEliminar = variantes.filter(v => v !== skuConservar);

    const filaConservar = await prisma.historialStockMayorista.findUnique({
      where: { proveedorId_sku: { proveedorId: grupo.proveedorId, sku: skuConservar } },
    });
    if (!filaConservar) continue;

    for (const skuElim of skusEliminar) {
      const filaElim = await prisma.historialStockMayorista.findUnique({
        where: { proveedorId_sku: { proveedorId: grupo.proveedorId, sku: skuElim } },
      });
      if (!filaElim) continue;

      console.log(`  conservar: "${skuConservar}" (id=${filaConservar.id}) | eliminar: "${skuElim}" (id=${filaElim.id})`);

      if (!dryRun) {
        // Si la fila a eliminar tiene productoId y la conservada no, transferirlo
        if (filaElim.productoId && !filaConservar.productoId) {
          await prisma.historialStockMayorista.update({
            where: { id: filaConservar.id },
            data: { productoId: filaElim.productoId },
          });
          // Actualizar el SKU del producto al código normalizado
          await prisma.producto.update({
            where: { id: filaElim.productoId },
            data: { sku: skuConservar },
          });
          console.log(`    → productoId=${filaElim.productoId} transferido y SKU producto actualizado a "${skuConservar}"`);
        }
        await prisma.historialStockMayorista.delete({ where: { id: filaElim.id } });
        eliminados++;
      }
    }
  }

  if (dryRun) {
    console.log("\n[DRY RUN] No se modificó nada.");
  } else {
    console.log(`\nListo: ${eliminados} filas eliminadas.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
