import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const provs = await db.proveedor.findMany();
  console.log("Proveedores:", provs.map(p => `${p.id}: ${p.nombre}`).join("\n"));
  const monami = provs.find(p => p.nombre.toLowerCase().includes("mon"));
  if (!monami) { console.log("No encontré Mon Ami"); return; }
  const count = await db.historialStockMayorista.count({ where: { proveedorId: monami.id } });
  const sample = await db.historialStockMayorista.findMany({ where: { proveedorId: monami.id }, take: 3 });
  console.log(`\nMon Ami (id=${monami.id}): ${count} items en lista`);
  console.log("Muestra:", JSON.stringify(sample, null, 2));
}
main().catch(console.error).finally(() => db.$disconnect());
