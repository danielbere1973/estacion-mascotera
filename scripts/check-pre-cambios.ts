import { PrismaClient } from "@prisma/client";
const neon = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
  // Productos sin proveedor
  const sinProveedor = await neon.producto.findMany({
    where: { proveedorId: null },
    select: { id: true, sku: true, nombre: true, marca: true },
  });
  console.log(`\n=== Productos sin proveedor: ${sinProveedor.length} ===`);
  sinProveedor.forEach(p => console.log(`  #${p.id} | ${p.sku} · ${p.nombre} (${p.marca})`));

  // Valores únicos de medioPago en ventas
  const ventas = await neon.venta.findMany({ select: { medioPago: true } });
  const medios = [...new Set(ventas.map(v => v.medioPago))].sort();
  console.log(`\n=== Medios de pago usados en ventas: ${medios.length} ===`);
  medios.forEach(m => console.log(`  "${m}"`));

  // Proveedores existentes
  const proveedores = await neon.proveedor.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } });
  console.log(`\n=== Proveedores existentes ===`);
  proveedores.forEach(p => console.log(`  #${p.id} · ${p.nombre}`));
}
main().catch(console.error).finally(() => neon.$disconnect());
