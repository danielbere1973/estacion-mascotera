import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
await prisma.$executeRawUnsafe(`ALTER TABLE "HistorialStockMayorista" ADD COLUMN IF NOT EXISTS "tipoProducto" TEXT;`);
console.log("OK");
await prisma.$disconnect();
