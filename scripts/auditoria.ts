import { PrismaClient } from "@prisma/client";

const cockroach = new PrismaClient({
  datasources: { db: { url: "postgresql://em_sysadmin:vZ6oi4baqjoxuhRf3hluxA@estacionmascotera-27518.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full" } },
});
const neon = new PrismaClient({
  datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } },
});

async function main() {
  console.log("=== AUDITORÍA DE BASE DE DATOS ===\n");

  // 1. Comparar conteos
  const [cVentas, nVentas] = await Promise.all([cockroach.venta.count(), neon.venta.count()]);
  const [cCompras, nCompras] = await Promise.all([cockroach.compra.count(), neon.compra.count()]);
  const [cGastos, nGastos] = await Promise.all([cockroach.gasto.count(), neon.gasto.count()]);
  const [cProductos, nProductos] = await Promise.all([cockroach.producto.count(), neon.producto.count()]);
  const [cClientes, nClientes] = await Promise.all([cockroach.cliente.count(), neon.cliente.count()]);
  const [cDetalles, nDetalles] = await Promise.all([cockroach.detalleVenta.count(), neon.detalleVenta.count()]);

  console.log("--- Conteo de registros ---");
  const ok = (a: number, b: number) => a === b ? "✓" : "⚠";
  console.log(`Ventas:    CDB=${cVentas}  Neon=${nVentas}  ${ok(cVentas, nVentas)}`);
  console.log(`Compras:   CDB=${cCompras}  Neon=${nCompras}  ${ok(cCompras, nCompras)}`);
  console.log(`Gastos:    CDB=${cGastos}  Neon=${nGastos}  ${ok(cGastos, nGastos)}`);
  console.log(`Productos: CDB=${cProductos}  Neon=${nProductos}  ${ok(cProductos, nProductos)}`);
  console.log(`Clientes:  CDB=${cClientes}  Neon=${nClientes}  ${ok(cClientes, nClientes)}`);
  console.log(`Detalles:  CDB=${cDetalles}  Neon=${nDetalles}  ${ok(cDetalles, nDetalles)}`);

  // 2. Compras en CDB que no están en Neon
  const idsComprasNeon = new Set((await neon.compra.findMany({ select: { id: true } })).map(r => r.id));
  const comprasFaltantes = (await cockroach.compra.findMany({ include: { producto: { select: { nombre: true, sku: true } } } }))
    .filter(r => !idsComprasNeon.has(r.id));
  if (comprasFaltantes.length > 0) {
    console.log(`\n⚠ Compras en CDB que faltan en Neon: ${comprasFaltantes.length}`);
    comprasFaltantes.forEach(c => console.log(`  #${c.id} - ${c.producto.nombre} (${c.producto.sku}) - ${new Date(c.fechaCompra).toLocaleDateString("es-AR")}`));
  }

  // 3. Ventas en CDB que no están en Neon
  const idsVentasNeon = new Set((await neon.venta.findMany({ select: { id: true } })).map(r => r.id));
  const ventasFaltantes = (await cockroach.venta.findMany({ include: { cliente: true } }))
    .filter(r => !idsVentasNeon.has(r.id));
  if (ventasFaltantes.length > 0) {
    console.log(`\n⚠ Ventas en CDB que faltan en Neon: ${ventasFaltantes.length}`);
    ventasFaltantes.forEach(v => console.log(`  #${v.id} - ${v.cliente.nombre} ${v.cliente.apellido} - ${new Date(v.fechaVenta).toLocaleDateString("es-AR")}`));
  }

  // 4. Gastos faltantes
  const idsGastosNeon = new Set((await neon.gasto.findMany({ select: { id: true } })).map(r => r.id));
  const gastosFaltantes = (await cockroach.gasto.findMany()).filter(r => !idsGastosNeon.has(r.id));
  if (gastosFaltantes.length > 0) {
    console.log(`\n⚠ Gastos en CDB que faltan en Neon: ${gastosFaltantes.length}`);
    gastosFaltantes.forEach(g => console.log(`  #${g.id} - ${g.categoriaGasto} - $${g.monto}`));
  }

  // 5. Productos en CDB que no están en Neon
  const idsProductosNeon = new Set((await neon.producto.findMany({ select: { id: true } })).map(r => r.id));
  const productosFaltantes = (await cockroach.producto.findMany({ select: { id: true, sku: true, nombre: true, stockActual: true } }))
    .filter(r => !idsProductosNeon.has(r.id));
  if (productosFaltantes.length > 0) {
    console.log(`\n⚠ Productos en CDB que faltan en Neon: ${productosFaltantes.length}`);
    productosFaltantes.forEach(p => console.log(`  #${p.id} - ${p.nombre} (${p.sku}) stock=${p.stockActual}`));
  }

  // 6. Stock desincronizado: productos donde el stock de Neon es distinto al esperado (compras - ventas)
  console.log("\n--- Stock en Neon ---");
  const productosNeon = await neon.producto.findMany({
    include: {
      compras: { select: { cantidad: true } },
      detalleVentas: { select: { cantidad: true } },
    },
  });
  const stockMal: { nombre: string; sku: string; actual: number; esperado: number }[] = [];
  for (const p of productosNeon) {
    const totalComprado = p.compras.reduce((s, c) => s + c.cantidad, 0);
    const totalVendido = p.detalleVentas.reduce((s, d) => s + d.cantidad, 0);
    const esperado = Math.max(0, totalComprado - totalVendido);
    if (p.stockActual !== esperado) {
      stockMal.push({ nombre: p.nombre, sku: p.sku, actual: p.stockActual, esperado });
    }
  }
  if (stockMal.length === 0) {
    console.log("✓ Todo el stock está correcto");
  } else {
    console.log(`⚠ ${stockMal.length} productos con stock desincronizado:`);
    stockMal.forEach(p => console.log(`  ${p.nombre} (${p.sku}): actual=${p.actual} esperado=${p.esperado}`));
  }

  // 7. Stock CDB vs Neon por SKU
  console.log("\n--- Stock CDB vs Neon por SKU ---");
  const neonPorSku = new Map(productosNeon.map(p => [p.sku, p]));
  const cdbProductos = await cockroach.producto.findMany({ select: { id: true, sku: true, nombre: true, stockActual: true } });
  const diferencias = cdbProductos.filter(p => {
    const n = neonPorSku.get(p.sku);
    return n && n.stockActual !== p.stockActual;
  });
  if (diferencias.length === 0) {
    console.log("✓ Stock igual en ambas bases");
  } else {
    console.log(`${diferencias.length} productos con stock diferente entre CDB y Neon:`);
    diferencias.forEach(p => {
      const n = neonPorSku.get(p.sku)!;
      console.log(`  ${p.nombre} (${p.sku}): CDB=${p.stockActual} Neon=${n.stockActual}`);
    });
  }
}

main().catch(console.error).finally(async () => {
  await cockroach.$disconnect();
  await neon.$disconnect();
});
