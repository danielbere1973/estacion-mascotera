import { PrismaClient } from "@prisma/client";
const p = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });
async function main() {
  await p.$executeRawUnsafe(`ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "skuInterno" TEXT`);
  console.log("✅ Columna skuInterno agregada a Producto");
}
main().catch(console.error).finally(() => p.$disconnect());
