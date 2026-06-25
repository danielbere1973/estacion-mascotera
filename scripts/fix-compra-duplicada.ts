import { PrismaClient } from "@prisma/client";
const neon = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
  // La compra #40 fue re-registrada como #49. Eliminar #40 de Neon y corregir stock.
  const compra = await neon.compra.findUnique({ where: { id: 40 }, include: { producto: { select: { id: true, nombre: true, stockActual: true } } } });
  if (!compra) { console.log("Compra #40 no existe en Neon."); return; }

  console.log(`Eliminando compra #40: ${compra.producto.nombre} qty=${compra.cantidad}`);
  console.log(`Stock actual: ${compra.producto.stockActual} → ${compra.producto.stockActual - compra.cantidad}`);

  await neon.$transaction(async (tx) => {
    await tx.producto.update({ where: { id: compra.productoId }, data: { stockActual: { decrement: compra.cantidad } } });
    await tx.compra.delete({ where: { id: 40 } });
  });

  const prod = await neon.producto.findUnique({ where: { id: compra.productoId }, select: { stockActual: true } });
  console.log(`\n✅ Hecho. Stock final: ${prod?.stockActual}`);
}
main().catch(console.error).finally(() => neon.$disconnect());
