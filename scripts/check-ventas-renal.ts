import { PrismaClient } from "@prisma/client";
const cockroach = new PrismaClient({ datasources: { db: { url: "postgresql://em_sysadmin:vZ6oi4baqjoxuhRf3hluxA@estacionmascotera-27518.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full" } } });
const neon = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
  // Verificar si compra #40 existe en CDB
  const c40cdb = await cockroach.compra.findUnique({ where: { id: 40 }, select: { id: true, cantidad: true, fechaCompra: true } });
  console.log("Compra #40 en CDB:", c40cdb ? `SÍ (qty=${c40cdb.cantidad})` : "NO (fue eliminada)");

  // Verificar si compra #40 existe en Neon
  const c40neon = await neon.compra.findUnique({ where: { id: 40 }, select: { id: true, cantidad: true, fechaCompra: true } });
  console.log("Compra #40 en Neon:", c40neon ? `SÍ (qty=${c40neon.cantidad})` : "NO");

  // Mostrar toda la situación del producto en Neon
  const prod = await neon.producto.findFirst({ where: { sku: "6502-1.5KG" }, select: { id: true, stockActual: true, nombre: true } });
  if (!prod) return;
  const compras = await neon.compra.findMany({ where: { productoId: prod.id }, select: { id: true, cantidad: true, fechaCompra: true } });
  const ventas = await neon.detalleVenta.findMany({ where: { productoId: prod.id }, include: { venta: { include: { cliente: { select: { nombre: true, apellido: true } } } } } });

  console.log(`\nNeon — ${prod.nombre} | stock: ${prod.stockActual}`);
  console.log("Compras:", compras.map(c => `#${c.id}(${new Date(c.fechaCompra).toLocaleDateString("es-AR")} qty=${c.cantidad})`).join(", "));
  console.log("Ventas:", ventas.map(d => `Detalle#${d.id}/Venta#${d.ventaId}(${d.venta.cliente.nombre} qty=${d.cantidad})`).join(", "));
  console.log(`Total comprado: ${compras.reduce((s,c)=>s+c.cantidad,0)} | Total vendido: ${ventas.reduce((s,d)=>s+d.cantidad,0)}`);
}
main().catch(console.error).finally(async () => { await cockroach.$disconnect(); await neon.$disconnect(); });
