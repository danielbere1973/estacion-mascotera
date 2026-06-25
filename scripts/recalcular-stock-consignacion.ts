import { PrismaClient } from "@prisma/client";
const p = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
  // Traer todos los items de consignaciones ENTREGAMOS con producto vinculado
  const items = await p.detalleConsignacion.findMany({
    where: {
      productoId: { not: null },
      consignacion: { direccion: "ENTREGAMOS" },
    },
    select: {
      productoId: true,
      cantidad: true,
      cantidadVendida: true,
    },
  });

  // Agrupar por producto: stockEnConsignacion = cantidad - cantidadVendida (lo que todavía está con el socio)
  const porProducto: Record<number, number> = {};
  for (const item of items) {
    const id = item.productoId!;
    const pendiente = item.cantidad - item.cantidadVendida;
    porProducto[id] = (porProducto[id] ?? 0) + pendiente;
  }

  console.log(`Productos a actualizar: ${Object.keys(porProducto).length}`);

  for (const [productoId, stock] of Object.entries(porProducto)) {
    await p.producto.update({
      where: { id: Number(productoId) },
      data: { stockEnConsignacion: stock },
    });
    console.log(`  Producto #${productoId} → stockEnConsignacion = ${stock}`);
  }

  console.log("✅ stockEnConsignacion recalculado");
}
main().catch(console.error).finally(() => p.$disconnect());
