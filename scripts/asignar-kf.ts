import { PrismaClient } from "@prisma/client";
const neon = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
  const res = await neon.compra.updateMany({
    where: { numeroPedido: null, proveedor: { nombre: { contains: "KF" } } },
    data: { numeroPedido: "KF001" },
  });
  console.log(`✅ ${res.count} compras de KF asignadas al pedido KF001`);
}
main().catch(console.error).finally(() => neon.$disconnect());
