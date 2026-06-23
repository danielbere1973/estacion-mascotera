import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const compras = await db.compra.findMany({
    orderBy: { id: "desc" },
    take: 10,
    include: { producto: true, proveedor: true },
  });
  console.log("Últimas compras:");
  for (const c of compras) {
    console.log(`  #${c.id} | ${c.proveedor.nombre} | SKU: ${c.producto.sku} | ${c.producto.nombre} | stock: ${c.producto.stockActual} | fecha: ${new Date(c.fechaCompra).toLocaleDateString("es-AR")}`);
  }
}
main().catch(console.error).finally(() => db.$disconnect());
