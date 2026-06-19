import { PrismaClient } from "@prisma/client";

const cockroach = new PrismaClient({
  datasources: { db: { url: "postgresql://em_sysadmin:vZ6oi4baqjoxuhRf3hluxA@estacionmascotera-27518.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full" } },
});

const neon = new PrismaClient({
  datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" } },
});

async function main() {
  console.log("Leyendo CockroachDB...");
  const usuarios      = await cockroach.usuario.findMany();
  const tiposProducto = await cockroach.tipoProducto.findMany();
  const proveedores   = await cockroach.proveedor.findMany();
  const clientes      = await cockroach.cliente.findMany();
  const productos     = await cockroach.producto.findMany();
  const compras       = await cockroach.compra.findMany();
  const ventas        = await cockroach.venta.findMany();
  const detalles      = await cockroach.detalleVenta.findMany();
  const gastos        = await cockroach.gasto.findMany();
  const logs          = await cockroach.logActividad.findMany();
  const historial     = await cockroach.historialStockMayorista.findMany();

  console.log(`Usuarios: ${usuarios.length} | Proveedores: ${proveedores.length} | Productos: ${productos.length}`);
  console.log(`Compras: ${compras.length} | Ventas: ${ventas.length} | Gastos: ${gastos.length} | Historial: ${historial.length}`);

  console.log("\nInsertando en Neon...");

  // Usuarios sin el FK a Proveedor (se actualiza después)
  for (const r of usuarios) {
    await neon.usuario.upsert({
      where: { id: r.id },
      update: { ...r, proveedorRestrictoId: null },
      create: { ...r, proveedorRestrictoId: null },
    });
  }
  console.log(`✓ ${usuarios.length} usuarios`);

  for (const r of tiposProducto) {
    await neon.tipoProducto.upsert({ where: { id: r.id }, update: r, create: r });
  }
  console.log(`✓ ${tiposProducto.length} tipos de producto`);

  for (const r of proveedores) {
    await neon.proveedor.upsert({ where: { id: r.id }, update: r, create: r });
  }
  console.log(`✓ ${proveedores.length} proveedores`);

  // Ahora actualizar usuarios con proveedorRestrictoId si lo tenían
  for (const r of usuarios.filter(u => u.proveedorRestrictoId)) {
    await neon.usuario.update({ where: { id: r.id }, data: { proveedorRestrictoId: r.proveedorRestrictoId } });
  }

  for (const r of clientes) {
    await neon.cliente.upsert({ where: { id: r.id }, update: r, create: r });
  }
  console.log(`✓ ${clientes.length} clientes`);

  for (const r of productos) {
    await neon.producto.upsert({ where: { id: r.id }, update: r, create: r });
  }
  console.log(`✓ ${productos.length} productos`);

  for (const r of compras) {
    await neon.compra.upsert({ where: { id: r.id }, update: r, create: r });
  }
  console.log(`✓ ${compras.length} compras`);

  for (const r of ventas) {
    await neon.venta.upsert({ where: { id: r.id }, update: r, create: r });
  }
  console.log(`✓ ${ventas.length} ventas`);

  for (const r of detalles) {
    await neon.detalleVenta.upsert({ where: { id: r.id }, update: r, create: r });
  }
  console.log(`✓ ${detalles.length} detalles de venta`);

  for (const r of gastos) {
    await neon.gasto.upsert({ where: { id: r.id }, update: r, create: r });
  }
  console.log(`✓ ${gastos.length} gastos`);

  for (const r of logs) {
    await neon.logActividad.upsert({ where: { id: r.id }, update: r, create: r });
  }
  console.log(`✓ ${logs.length} logs`);

  for (const r of historial) {
    await neon.historialStockMayorista.upsert({ where: { id: r.id }, update: r, create: r });
  }
  console.log(`✓ ${historial.length} historial mayorista`);

  // Resetear sequences
  console.log("\nReseteando sequences...");
  const seqs: [string, number][] = [
    ["Usuario",                  Math.max(0, ...usuarios.map(r => r.id))],
    ["TipoProducto",             Math.max(0, ...tiposProducto.map(r => r.id))],
    ["Proveedor",                Math.max(0, ...proveedores.map(r => r.id))],
    ["Cliente",                  Math.max(0, ...clientes.map(r => r.id))],
    ["Producto",                 Math.max(0, ...productos.map(r => r.id))],
    ["Compra",                   Math.max(0, ...compras.map(r => r.id))],
    ["Venta",                    Math.max(0, ...ventas.map(r => r.id))],
    ["DetalleVenta",             Math.max(0, ...detalles.map(r => r.id))],
    ["Gasto",                    Math.max(0, ...gastos.map(r => r.id))],
    ["LogActividad",             Math.max(0, ...logs.map(r => r.id))],
    ["HistorialStockMayorista",  Math.max(0, ...historial.map(r => r.id))],
  ];

  for (const [tabla, maxId] of seqs) {
    if (maxId > 0) {
      await neon.$executeRawUnsafe(`SELECT setval('"${tabla}_id_seq"', ${maxId})`);
      console.log(`  ${tabla}: ${maxId}`);
    }
  }

  console.log("\n✅ Migración completa.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await cockroach.$disconnect(); await neon.$disconnect(); });
