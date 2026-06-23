/**
 * Migra a Neon solo los registros nuevos que existen en CockroachDB pero no en Neon.
 * No toca los datos que ya están en Neon.
 */
import { PrismaClient } from "@prisma/client";

const cockroach = new PrismaClient({
  datasources: { db: { url: "postgresql://em_sysadmin:vZ6oi4baqjoxuhRf3hluxA@estacionmascotera-27518.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full" } },
});

const neon = new PrismaClient({
  datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } },
});

async function main() {
  console.log("Leyendo diferencias...\n");

  // IDs ya en Neon
  const neonIds = {
    clientes: new Set((await neon.cliente.findMany({ select: { id: true } })).map(r => r.id)),
    productos: new Set((await neon.producto.findMany({ select: { id: true } })).map(r => r.id)),
    compras: new Set((await neon.compra.findMany({ select: { id: true } })).map(r => r.id)),
    ventas: new Set((await neon.venta.findMany({ select: { id: true } })).map(r => r.id)),
    detalles: new Set((await neon.detalleVenta.findMany({ select: { id: true } })).map(r => r.id)),
    gastos: new Set((await neon.gasto.findMany({ select: { id: true } })).map(r => r.id)),
  };

  // Clientes nuevos
  const clientesNuevos = (await cockroach.cliente.findMany()).filter(r => !neonIds.clientes.has(r.id));
  for (const r of clientesNuevos) {
    await neon.cliente.create({ data: r });
  }
  console.log(`✓ ${clientesNuevos.length} clientes nuevos`);

  // Productos nuevos (select explícito para evitar proveedorId que no existe en CockroachDB)
  const productosNuevos = (await cockroach.producto.findMany({
    select: { id: true, sku: true, nombre: true, marca: true, categoria: true, presentacion: true,
      unidadMedida: true, contenido: true, stockActual: true, precioCostoUnitario: true,
      margenPorcentaje: true, precioVenta: true, createdAt: true, updatedAt: true },
  })).filter(r => !neonIds.productos.has(r.id));
  for (const r of productosNuevos) {
    await neon.producto.create({ data: { ...r, proveedorId: null } });
  }
  console.log(`✓ ${productosNuevos.length} productos nuevos`);

  // Ventas nuevas
  const ventasNuevas = (await cockroach.venta.findMany()).filter(r => !neonIds.ventas.has(r.id));
  for (const r of ventasNuevas) {
    await neon.venta.create({ data: r });
  }
  console.log(`✓ ${ventasNuevas.length} ventas nuevas`);

  // Detalles de venta nuevos
  const detallesNuevos = (await cockroach.detalleVenta.findMany()).filter(r => !neonIds.detalles.has(r.id));
  for (const r of detallesNuevos) {
    await neon.detalleVenta.create({ data: r });
  }
  console.log(`✓ ${detallesNuevos.length} detalles de venta nuevos`);

  // Compras nuevas
  const comprasNuevas = (await cockroach.compra.findMany()).filter(r => !neonIds.compras.has(r.id));
  for (const r of comprasNuevas) {
    await neon.compra.create({ data: r });
  }
  console.log(`✓ ${comprasNuevas.length} compras nuevas`);

  // Gastos nuevos
  const gastosNuevos = (await cockroach.gasto.findMany()).filter(r => !neonIds.gastos.has(r.id));
  for (const r of gastosNuevos) {
    await neon.gasto.create({ data: r });
  }
  console.log(`✓ ${gastosNuevos.length} gastos nuevos`);

  // Actualizar sequences
  const maxVenta = Math.max(...(await neon.venta.findMany({ select: { id: true } })).map(r => r.id));
  const maxCompra = Math.max(...(await neon.compra.findMany({ select: { id: true } })).map(r => r.id));
  const maxProducto = Math.max(...(await neon.producto.findMany({ select: { id: true } })).map(r => r.id));
  const maxCliente = Math.max(...(await neon.cliente.findMany({ select: { id: true } })).map(r => r.id));
  const maxGasto = Math.max(...(await neon.gasto.findMany({ select: { id: true } })).map(r => r.id));
  const maxDetalle = Math.max(...(await neon.detalleVenta.findMany({ select: { id: true } })).map(r => r.id));

  await neon.$executeRawUnsafe(`SELECT setval('"Venta_id_seq"', ${maxVenta})`);
  await neon.$executeRawUnsafe(`SELECT setval('"Compra_id_seq"', ${maxCompra})`);
  await neon.$executeRawUnsafe(`SELECT setval('"Producto_id_seq"', ${maxProducto})`);
  await neon.$executeRawUnsafe(`SELECT setval('"Cliente_id_seq"', ${maxCliente})`);
  await neon.$executeRawUnsafe(`SELECT setval('"Gasto_id_seq"', ${maxGasto})`);
  await neon.$executeRawUnsafe(`SELECT setval('"DetalleVenta_id_seq"', ${maxDetalle})`);

  console.log("\n✅ Sincronización completa. Ahora podés cambiar el DATABASE_URL en Vercel.");
}

main().catch(console.error).finally(async () => {
  await cockroach.$disconnect();
  await neon.$disconnect();
});
