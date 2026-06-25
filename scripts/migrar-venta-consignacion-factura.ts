import { PrismaClient } from "@prisma/client";
const p = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });
async function main() {
  await p.$executeRawUnsafe(`ALTER TABLE "VentaConsignacion" ADD COLUMN IF NOT EXISTS "facturado" BOOLEAN NOT NULL DEFAULT false`);
  await p.$executeRawUnsafe(`ALTER TABLE "VentaConsignacion" ADD COLUMN IF NOT EXISTS "numeroFactura" TEXT`);
  console.log("✅ Campos facturado y numeroFactura agregados a VentaConsignacion");
}
main().catch(console.error).finally(() => p.$disconnect());
