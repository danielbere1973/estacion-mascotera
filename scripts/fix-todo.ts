import { PrismaClient } from "@prisma/client";

const cockroach = new PrismaClient({
  datasources: { db: { url: "postgresql://em_sysadmin:vZ6oi4baqjoxuhRf3hluxA@estacionmascotera-27518.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full" } },
});
const neon = new PrismaClient({
  datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } },
});

async function main() {
  // 1. Importar compras de CDB que faltan en Neon
  console.log("1. Sincronizando compras faltantes...");
  const idsComprasNeon = new Set((await neon.compra.findMany({ select: { id: true } })).map(r => r.id));
  const comprasCDB = await cockroach.compra.findMany({
    select: {
      id: true, proveedorId: true, productoId: true, cantidad: true,
      precioCostoUnitario: true, descuentoPorcentaje: true, costoEnvio: true,
      numeroPedido: true, facturado: true, numeroFactura: true,
      fechaCompra: true, usuarioId: true, pagadoPorId: true,
    },
  });
  const comprasFaltantes = comprasCDB.filter(c => !idsComprasNeon.has(c.id));

  for (const c of comprasFaltantes) {
    // Verificar que el productoId existe en Neon
    const prod = await neon.producto.findUnique({ where: { id: c.productoId } });
    if (!prod) { console.log(`  Skipping compra #${c.id}: producto #${c.productoId} no existe en Neon`); continue; }
    await neon.compra.create({ data: c });
    console.log(`  ✓ Compra #${c.id} importada`);
  }
  if (comprasFaltantes.length === 0) console.log("  ✓ No hay compras faltantes");

  // 2. Importar ventas/detalles de CDB que faltan en Neon
  console.log("\n2. Sincronizando ventas faltantes...");
  const idsVentasNeon = new Set((await neon.venta.findMany({ select: { id: true } })).map(r => r.id));
  const ventasCDB = await cockroach.venta.findMany();
  const ventasFaltantes = ventasCDB.filter(v => !idsVentasNeon.has(v.id));
  for (const v of ventasFaltantes) {
    await neon.venta.create({ data: v });
    console.log(`  ✓ Venta #${v.id} importada`);
  }
  const idsDetallesNeon = new Set((await neon.detalleVenta.findMany({ select: { id: true } })).map(r => r.id));
  const detallesCDB = await cockroach.detalleVenta.findMany();
  const detallesFaltantes = detallesCDB.filter(d => !idsDetallesNeon.has(d.id));
  for (const d of detallesFaltantes) {
    const existe = await neon.detalleVenta.findUnique({ where: { id: d.id } });
    if (existe) continue;
    await neon.detalleVenta.create({ data: d });
    console.log(`  ✓ Detalle #${d.id} importado`);
  }
  if (ventasFaltantes.length === 0) console.log("  ✓ No hay ventas faltantes");

  // 3. Restaurar stock de productos que tenían stock en CDB pero no tienen compras en Neon
  console.log("\n3. Restaurando stock de productos sin compras registradas...");
  const productosCDB = await cockroach.producto.findMany({
    select: { id: true, sku: true, nombre: true, stockActual: true },
  });
  const productosNeon = await neon.producto.findMany({
    include: {
      compras: { select: { cantidad: true } },
      detalleVentas: { select: { cantidad: true } },
    },
  });
  const neonPorSku = new Map(productosNeon.map(p => [p.sku, p]));

  for (const pc of productosCDB) {
    const pn = neonPorSku.get(pc.sku);
    if (!pn) continue;
    const totalComprado = pn.compras.reduce((s, c) => s + c.cantidad, 0);
    const totalVendido = pn.detalleVentas.reduce((s, d) => s + d.cantidad, 0);
    // Si no hay compras registradas, el stock viene de carga manual → usar el de CDB
    const stockCorrecto = totalComprado === 0 && pc.stockActual > 0
      ? pc.stockActual - totalVendido  // stock manual de CDB menos lo vendido en Neon
      : Math.max(0, totalComprado - totalVendido);
    if (pn.stockActual !== stockCorrecto) {
      await neon.producto.update({ where: { id: pn.id }, data: { stockActual: Math.max(0, stockCorrecto) } });
      console.log(`  ${pn.nombre} (${pn.sku}): ${pn.stockActual} → ${Math.max(0, stockCorrecto)}`);
    }
  }

  // 4. Recalcular stock general (compras - ventas) para los que SÍ tienen compras
  console.log("\n4. Recalculando stock con compras actualizadas...");
  const productosNeonFinal = await neon.producto.findMany({
    include: {
      compras: { select: { cantidad: true } },
      detalleVentas: { select: { cantidad: true } },
    },
  });
  let corregidos = 0;
  for (const p of productosNeonFinal) {
    const totalComprado = p.compras.reduce((s, c) => s + c.cantidad, 0);
    const totalVendido = p.detalleVentas.reduce((s, d) => s + d.cantidad, 0);
    if (totalComprado === 0) continue; // ya manejado en paso 3
    const esperado = Math.max(0, totalComprado - totalVendido);
    if (p.stockActual !== esperado) {
      await neon.producto.update({ where: { id: p.id }, data: { stockActual: esperado } });
      console.log(`  ${p.nombre} (${p.sku}): ${p.stockActual} → ${esperado}`);
      corregidos++;
    }
  }
  if (corregidos === 0) console.log("  ✓ Todo correcto");

  // 5. Resumen final
  console.log("\n=== RESUMEN FINAL ===");
  const [nVentas, nCompras, nGastos, nProductos] = await Promise.all([
    neon.venta.count(), neon.compra.count(), neon.gasto.count(), neon.producto.count(),
  ]);
  console.log(`Ventas: ${nVentas} | Compras: ${nCompras} | Gastos: ${nGastos} | Productos: ${nProductos}`);

  const conStock = await neon.producto.count({ where: { stockActual: { gt: 0 } } });
  console.log(`Productos con stock > 0: ${conStock}`);
  console.log("\n✅ Todo sincronizado.");
}

main().catch(console.error).finally(async () => {
  await cockroach.$disconnect();
  await neon.$disconnect();
});
