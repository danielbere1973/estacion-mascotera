import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const productos = await db.producto.findMany({
    include: {
      compras: { select: { cantidad: true } },
      detalleVentas: { select: { cantidad: true } },
    },
  });

  let actualizados = 0;
  for (const p of productos) {
    const totalComprado = p.compras.reduce((s, c) => s + c.cantidad, 0);
    const totalVendido = p.detalleVentas.reduce((s, d) => s + d.cantidad, 0);
    const stockEsperado = Math.max(0, totalComprado - totalVendido);

    if (p.stockActual !== stockEsperado) {
      await db.producto.update({ where: { id: p.id }, data: { stockActual: stockEsperado } });
      console.log(`${p.nombre} (${p.sku}): ${p.stockActual} → ${stockEsperado}`);
      actualizados++;
    }
  }

  console.log(`\n✅ ${actualizados} productos corregidos.`);
}

main().catch(console.error).finally(() => db.$disconnect());
