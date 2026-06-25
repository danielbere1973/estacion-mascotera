import { PrismaClient } from "@prisma/client";

const cockroach = new PrismaClient({
  datasources: { db: { url: "postgresql://em_sysadmin:vZ6oi4baqjoxuhRf3hluxA@estacionmascotera-27518.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full" } },
});
const neon = new PrismaClient({
  datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } },
});

async function main() {
  // Buscar ventas que existen en Neon pero NO en CockroachDB (fueron borradas en CDB durante el período de migración)
  const ventasNeon = await neon.venta.findMany({ select: { id: true }, orderBy: { id: "asc" } });
  const ventasCDB = await cockroach.venta.findMany({ select: { id: true } });
  const idsCDB = new Set(ventasCDB.map(v => v.id));

  // Solo comparar ventas con IDs que existían en CDB (< máximo ID de CDB)
  const maxIdCDB = Math.max(...ventasCDB.map(v => v.id));
  const ventasHuerfanas = ventasNeon.filter(v => v.id <= maxIdCDB && !idsCDB.has(v.id));

  if (ventasHuerfanas.length === 0) {
    console.log("No hay ventas huérfanas (eliminadas en CDB pero presentes en Neon).");
    return;
  }

  console.log(`Ventas eliminadas en CDB que siguen en Neon: ${ventasHuerfanas.map(v => `#${v.id}`).join(", ")}`);

  for (const v of ventasHuerfanas) {
    // Recuperar detalles para revertir el stock
    const detalles = await neon.detalleVenta.findMany({ where: { ventaId: v.id } });
    for (const d of detalles) {
      await neon.producto.update({
        where: { id: d.productoId },
        data: { stockActual: { increment: d.cantidad } },
      });
      console.log(`  Stock restaurado: producto #${d.productoId} +${d.cantidad}`);
    }
    // Eliminar la venta (cascade elimina detalles)
    await neon.venta.delete({ where: { id: v.id } });
    console.log(`  Venta #${v.id} eliminada de Neon.`);
  }

  console.log("\n✅ Listo.");
}

main().catch(console.error).finally(async () => {
  await cockroach.$disconnect();
  await neon.$disconnect();
});
