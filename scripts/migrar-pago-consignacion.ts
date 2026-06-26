import { PrismaClient } from "@prisma/client";
const p = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });
async function main() {
  await p.$executeRawUnsafe(`DROP TABLE IF EXISTS "PagoLiquidacion"`);
  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PagoConsignacion" (
      "id" SERIAL PRIMARY KEY,
      "consignacionId" INTEGER NOT NULL REFERENCES "Consignacion"("id"),
      "fecha" TIMESTAMP NOT NULL DEFAULT NOW(),
      "monto" DECIMAL NOT NULL,
      "notas" TEXT
    )
  `);
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_pago_consignacion" ON "PagoConsignacion"("consignacionId")`);
  console.log("✅ PagoConsignacion creada, PagoLiquidacion eliminada");
}
main().catch(console.error).finally(() => p.$disconnect());
