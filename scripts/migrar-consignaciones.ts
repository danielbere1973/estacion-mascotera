import { PrismaClient } from "@prisma/client";
const neon = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
  // Enums (con DO block para evitar error si ya existen)
  await neon.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "DireccionConsignacion" AS ENUM ('ENTREGAMOS','RECIBIMOS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  await neon.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "EstadoConsignacion" AS ENUM ('ABIERTA','CERRADA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  await neon.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "EstadoDropshipping" AS ENUM ('PENDIENTE','DESPACHADO','ENTREGADO','CANCELADO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  console.log("✅ Enums creados");

  await neon.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SocioConsignacion" (
      "id" SERIAL PRIMARY KEY,
      "nombre" TEXT NOT NULL,
      "contacto" TEXT,
      "notas" TEXT,
      "proveedorId" INTEGER REFERENCES "Proveedor"("id")
    )
  `);

  await neon.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LiquidacionConsignacion" (
      "id" SERIAL PRIMARY KEY,
      "socioId" INTEGER NOT NULL REFERENCES "SocioConsignacion"("id"),
      "fechaDesde" TIMESTAMP NOT NULL,
      "fechaHasta" TIMESTAMP NOT NULL,
      "fecha" TIMESTAMP NOT NULL DEFAULT NOW(),
      "totalACobrarnos" DECIMAL NOT NULL DEFAULT 0,
      "totalACobrarles" DECIMAL NOT NULL DEFAULT 0,
      "saldo" DECIMAL NOT NULL DEFAULT 0,
      "pagado" BOOLEAN NOT NULL DEFAULT false,
      "fechaPago" TIMESTAMP,
      "notas" TEXT
    )
  `);

  await neon.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Consignacion" (
      "id" SERIAL PRIMARY KEY,
      "socioId" INTEGER NOT NULL REFERENCES "SocioConsignacion"("id"),
      "direccion" "DireccionConsignacion" NOT NULL,
      "estado" "EstadoConsignacion" NOT NULL DEFAULT 'ABIERTA',
      "fecha" TIMESTAMP NOT NULL DEFAULT NOW(),
      "notas" TEXT,
      "liquidacionId" INTEGER REFERENCES "LiquidacionConsignacion"("id")
    )
  `);

  await neon.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DetalleConsignacion" (
      "id" SERIAL PRIMARY KEY,
      "consignacionId" INTEGER NOT NULL REFERENCES "Consignacion"("id"),
      "productoId" INTEGER REFERENCES "Producto"("id"),
      "descripcion" TEXT,
      "cantidad" INTEGER NOT NULL,
      "precioCosto" DECIMAL NOT NULL,
      "precioPiso" DECIMAL NOT NULL,
      "cantidadVendida" INTEGER NOT NULL DEFAULT 0
    )
  `);

  await neon.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VentaConsignacion" (
      "id" SERIAL PRIMARY KEY,
      "detalleConsignacionId" INTEGER NOT NULL REFERENCES "DetalleConsignacion"("id"),
      "fecha" TIMESTAMP NOT NULL DEFAULT NOW(),
      "cantidad" INTEGER NOT NULL,
      "precioVentaReal" DECIMAL NOT NULL,
      "liquidacionId" INTEGER REFERENCES "LiquidacionConsignacion"("id")
    )
  `);

  await neon.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OrdenDropshipping" (
      "id" SERIAL PRIMARY KEY,
      "socioId" INTEGER NOT NULL REFERENCES "SocioConsignacion"("id"),
      "clienteId" INTEGER REFERENCES "Cliente"("id"),
      "clienteNombre" TEXT,
      "fecha" TIMESTAMP NOT NULL DEFAULT NOW(),
      "estado" "EstadoDropshipping" NOT NULL DEFAULT 'PENDIENTE',
      "productoId" INTEGER REFERENCES "Producto"("id"),
      "descripcion" TEXT,
      "cantidad" INTEGER NOT NULL,
      "precioCosto" DECIMAL NOT NULL,
      "precioVenta" DECIMAL NOT NULL,
      "facturadoAlCliente" BOOLEAN NOT NULL DEFAULT false,
      "facturadoPorProveedor" BOOLEAN NOT NULL DEFAULT false,
      "numeroFacturaCliente" TEXT,
      "numeroFacturaProveedor" TEXT,
      "notas" TEXT
    )
  `);

  // Índices
  const indices = [
    `CREATE INDEX IF NOT EXISTS "idx_consignacion_socio" ON "Consignacion"("socioId")`,
    `CREATE INDEX IF NOT EXISTS "idx_consignacion_estado" ON "Consignacion"("estado")`,
    `CREATE INDEX IF NOT EXISTS "idx_detalle_consignacion" ON "DetalleConsignacion"("consignacionId")`,
    `CREATE INDEX IF NOT EXISTS "idx_venta_consignacion_detalle" ON "VentaConsignacion"("detalleConsignacionId")`,
    `CREATE INDEX IF NOT EXISTS "idx_liquidacion_socio" ON "LiquidacionConsignacion"("socioId")`,
    `CREATE INDEX IF NOT EXISTS "idx_dropshipping_socio" ON "OrdenDropshipping"("socioId")`,
    `CREATE INDEX IF NOT EXISTS "idx_dropshipping_estado" ON "OrdenDropshipping"("estado")`,
  ];
  for (const idx of indices) await neon.$executeRawUnsafe(idx);

  console.log("✅ Todas las tablas e índices de consignaciones creados");
}
main().catch(console.error).finally(() => neon.$disconnect());
