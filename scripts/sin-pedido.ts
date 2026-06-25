import { PrismaClient } from "@prisma/client";
const neon = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
  const compras = await neon.compra.findMany({
    where: { numeroPedido: null },
    include: { producto: { select: { sku: true, nombre: true } }, proveedor: { select: { nombre: true } } },
    orderBy: { fechaCompra: "asc" },
  });
  console.log(`Compras sin número de pedido: ${compras.length}`);
  compras.forEach(c =>
    console.log(`  #${c.id} | ${new Date(c.fechaCompra).toLocaleDateString("es-AR")} | ${c.proveedor.nombre} | ${c.producto.sku} · ${c.producto.nombre} | $${c.precioCostoUnitario}`)
  );
}
main().catch(console.error).finally(() => neon.$disconnect());
