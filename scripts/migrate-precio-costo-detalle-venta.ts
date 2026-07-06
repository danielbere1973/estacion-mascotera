/**
 * Migración one-off: pobla precioCostoUnitario en DetalleVenta existentes
 * usando la compra más reciente del mismo producto anterior a la fecha de la venta.
 * Si no hay compra anterior, usa el precio de costo actual del producto.
 *
 * Ejecutar: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-precio-costo-detalle-venta.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const detalles = await prisma.detalleVenta.findMany({
    where: { precioCostoUnitario: null },
    select: {
      id: true,
      productoId: true,
      venta: { select: { fechaVenta: true } },
      producto: { select: { precioCostoUnitario: true } },
    },
  });

  console.log(`Detalles a migrar: ${detalles.length}`);
  let actualizados = 0;
  let sinCompra = 0;

  for (const d of detalles) {
    // Buscar la compra más reciente de ese producto antes de la fecha de la venta
    const compra = await prisma.compra.findFirst({
      where: {
        productoId: d.productoId,
        fechaCompra: { lte: d.venta.fechaVenta },
      },
      orderBy: { fechaCompra: "desc" },
      select: { precioCostoUnitario: true },
    });

    const precioCosto = compra?.precioCostoUnitario ?? d.producto.precioCostoUnitario;

    if (!compra) sinCompra++;

    await prisma.detalleVenta.update({
      where: { id: d.id },
      data: { precioCostoUnitario: precioCosto },
    });

    actualizados++;
    if (actualizados % 50 === 0) console.log(`  ${actualizados}/${detalles.length}...`);
  }

  console.log(`\nListo: ${actualizados} actualizados (${sinCompra} usaron precio actual del producto por no tener compra previa)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
