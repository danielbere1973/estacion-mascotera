import { PrismaClient } from "@prisma/client";
const cdb = new PrismaClient({ datasources: { db: { url: "postgresql://em_sysadmin:vZ6oi4baqjoxuhRf3hluxA@estacionmascotera-27518.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full" } } });
const neon = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

// Compras que faltan en Neon: [SKU, fecha aprox, numeroPedido]
const buscar = [
  { sku: "2156-1.5KG", fecha: "2026-06-12", pedido: "733" },
  { sku: "2156-1.5KG", fecha: "2026-06-16", pedido: "572" },
  { sku: "1331-1.5KG", fecha: "2026-06-16", pedido: "572" },
];

async function main() {
  // IDs ya existentes en Neon para no duplicar
  const idsNeon = new Set((await neon.compra.findMany({ select: { id: true } })).map(c => c.id));

  for (const b of buscar) {
    const desde = new Date(b.fecha + "T00:00:00-03:00");
    const hasta = new Date(b.fecha + "T23:59:59-03:00");

    const encontradas = await cdb.compra.findMany({
      where: {
        fechaCompra: { gte: desde, lte: hasta },
        producto: { sku: b.sku },
      },
      select: {
        id: true, cantidad: true, precioCostoUnitario: true, descuentoPorcentaje: true,
        costoEnvio: true, facturado: true, numeroFactura: true, numeroPedido: true,
        fechaCompra: true, productoId: true, proveedorId: true, pagadoPorId: true, usuarioId: true,
        producto: { select: { sku: true, nombre: true } },
      },
    });

    if (encontradas.length === 0) {
      console.log(`⚠ No encontré en CDB: ${b.sku} del ${b.fecha}`);
      continue;
    }

    for (const c of encontradas) {
      if (idsNeon.has(c.id)) {
        console.log(`  Ya existe en Neon: #${c.id} ${c.producto.sku}`);
        continue;
      }

      // Verificar que el producto existe en Neon
      const prodNeon = await neon.producto.findFirst({ where: { sku: c.producto.sku }, select: { id: true } });
      if (!prodNeon) { console.log(`  ⚠ Producto ${c.producto.sku} no existe en Neon`); continue; }

      // Importar
      await neon.$transaction(async (tx) => {
        await tx.compra.create({
          data: {
            id: c.id,
            cantidad: c.cantidad,
            precioCostoUnitario: c.precioCostoUnitario,
            descuentoPorcentaje: c.descuentoPorcentaje,
            costoEnvio: c.costoEnvio,
            facturado: c.facturado,
            numeroFactura: c.numeroFactura,
            numeroPedido: b.pedido,
            fechaCompra: c.fechaCompra,
            productoId: prodNeon.id,
            proveedorId: c.proveedorId,
            pagadoPorId: c.pagadoPorId,
            usuarioId: c.usuarioId,
          },
        });
        await tx.producto.update({ where: { id: prodNeon.id }, data: { stockActual: { increment: c.cantidad } } });
      });

      console.log(`✅ Importado: #${c.id} | ${c.producto.sku} | pedido ${b.pedido} | qty=${c.cantidad}`);
    }
  }
}
main().catch(console.error).finally(async () => { await cdb.$disconnect(); await neon.$disconnect(); });
