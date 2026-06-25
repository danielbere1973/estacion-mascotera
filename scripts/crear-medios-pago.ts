import { PrismaClient } from "@prisma/client";
const neon = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
  // Crear tabla
  await neon.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MedioPago" (
      "id" SERIAL PRIMARY KEY,
      "nombre" TEXT NOT NULL UNIQUE,
      "activo" BOOLEAN NOT NULL DEFAULT true
    )
  `);
  console.log("✅ Tabla MedioPago creada");

  // Cargar opciones limpias (incluyendo todas las variantes existentes normalizadas)
  const medios = [
    "Efectivo",
    "Transferencia",
    "Mercado Pago",
    "Pagos Nube",
    "Link de Pago",
    "Cheque",
    "Depósito Bancario",
    "Pago Fácil",
  ];

  for (const nombre of medios) {
    await neon.$executeRawUnsafe(
      `INSERT INTO "MedioPago" ("nombre") VALUES ($1) ON CONFLICT ("nombre") DO NOTHING`,
      nombre
    );
  }
  console.log(`✅ ${medios.length} medios de pago cargados`);

  // Regenerar cliente
  console.log("\nNota: ejecutar 'npx prisma generate' para actualizar el cliente.");
}
main().catch(console.error).finally(() => neon.$disconnect());
