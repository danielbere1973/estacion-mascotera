import { PrismaClient } from "@prisma/client";
const p = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });
async function main() {
  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PagoLiquidacion" (
      "id" SERIAL PRIMARY KEY,
      "liquidacionId" INTEGER NOT NULL REFERENCES "LiquidacionConsignacion"("id"),
      "fecha" TIMESTAMP NOT NULL DEFAULT NOW(),
      "monto" DECIMAL NOT NULL,
      "notas" TEXT
    )
  `);
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_pago_liquidacion" ON "PagoLiquidacion"("liquidacionId")`);
  console.log("✅ Tabla PagoLiquidacion creada");
}
main().catch(console.error).finally(() => p.$disconnect());
