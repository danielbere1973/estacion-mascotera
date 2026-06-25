import { PrismaClient } from "@prisma/client";
const neon = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
  // Compra #4: RC URINARY 12/06 → pedido 733
  await neon.compra.update({ where: { id: 4 }, data: { numeroPedido: "733" } });
  console.log("✅ Compra #4 (RC URINARY 12/06) → pedido 733");
}
main().catch(console.error).finally(() => neon.$disconnect());
