import { PrismaClient } from "@prisma/client";
const neon = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
  const sinProveedor = await neon.producto.findMany({
    where: { proveedorId: null },
    select: { id: true, sku: true, nombre: true, marca: true },
  });
  console.log("Sin proveedor:", sinProveedor);

  // Asignar CIERRE_CICLO a Happy Pets
  if (sinProveedor.some(p => p.id === 33)) {
    await neon.producto.update({ where: { id: 33 }, data: { proveedorId: 6 } });
    console.log("✅ CIERRE_CICLO → Happy Pets");
  } else if (sinProveedor.length > 0) {
    // Asignar el restante a HYM por defecto
    for (const p of sinProveedor) {
      await neon.producto.update({ where: { id: p.id }, data: { proveedorId: 5 } });
      console.log(`✅ #${p.id} ${p.sku} → HYM`);
    }
  }

  const final = await neon.producto.count({ where: { proveedorId: null } });
  console.log(`\nProductos sin proveedor: ${final}`);
}
main().catch(console.error).finally(() => neon.$disconnect());
