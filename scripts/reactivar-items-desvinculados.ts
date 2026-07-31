import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.historialStockMayorista.updateMany({
    where: { productoId: null, activo: false },
    data: { activo: true },
  });
  console.log("Reactivados:", r.count);
}
main().catch(console.error).finally(() => prisma.$disconnect());
