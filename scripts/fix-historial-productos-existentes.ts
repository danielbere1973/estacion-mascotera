/**
 * One-off: agrega entradas en historialStockMayorista para productos que
 * fueron creados manualmente en inventario pero nunca tuvieron entrada en el historial.
 * Esto hace que aparezcan en el formulario de compra de su proveedor.
 *
 * Ejecutar: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fix-historial-productos-existentes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Productos con proveedor asignado
  const productos = await prisma.producto.findMany({
    where: { proveedorId: { not: null } },
    select: { id: true, sku: true, nombre: true, precioCostoUnitario: true, proveedorId: true, proveedor: { select: { nombre: true } } },
  });

  console.log(`Productos con proveedor: ${productos.length}`);

  let agregados = 0;
  let yaExistian = 0;

  for (const p of productos) {
    const existente = await prisma.historialStockMayorista.findFirst({
      where: { proveedorId: p.proveedorId!, sku: p.sku },
    });

    if (existente) {
      yaExistian++;
      // Si no tiene productoId vinculado, lo actualizamos
      if (!existente.productoId) {
        await prisma.historialStockMayorista.update({
          where: { id: existente.id },
          data: { productoId: p.id },
        });
        console.log(`  Vinculado productoId en historial existente: ${p.nombre} (${p.sku})`);
      }
      continue;
    }

    await prisma.historialStockMayorista.create({
      data: {
        proveedorId: p.proveedorId!,
        sku: p.sku,
        nombre: p.nombre,
        precioCostoScraped: p.precioCostoUnitario,
        productoId: p.id,
      },
    });
    console.log(`  Agregado: ${p.nombre} (${p.sku}) → proveedor: ${p.proveedor?.nombre}`);
    agregados++;
  }

  console.log(`\nListo: ${agregados} agregados, ${yaExistian} ya existían.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
