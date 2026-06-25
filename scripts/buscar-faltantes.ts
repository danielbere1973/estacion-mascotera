import { PrismaClient } from "@prisma/client";
const neon = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
  const compras = await neon.compra.findMany({
    where: { producto: { sku: { in: ["2156-1.5KG", "1331-1.5KG", "2152", "02152"] } } },
    include: { producto: { select: { sku: true, nombre: true } } },
    orderBy: { fechaCompra: "asc" },
  });
  compras.forEach(c =>
    console.log(`#${c.id} | ${new Date(c.fechaCompra).toLocaleDateString("es-AR")} | ${c.producto.sku} · ${c.producto.nombre} | $${c.precioCostoUnitario} | pedido=${c.numeroPedido ?? "—"}`)
  );
}
main().catch(console.error).finally(() => neon.$disconnect());
