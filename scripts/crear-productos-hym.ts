import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HYM_ID = 5;

async function main() {
  const items = await prisma.historialStockMayorista.findMany({
    where: { proveedorId: HYM_ID, productoId: null },
    orderBy: { sku: "asc" },
  });

  console.log(`Items HYM sin producto: ${items.length}`);

  let creados = 0;
  let errores = 0;

  for (const item of items) {
    const nombre = [item.nombre, item.tamanios].filter(Boolean).join(" · ") || item.sku;
    const precioCosto = Number(item.precioConDescuento ?? item.precioCostoScraped);

    try {
      // Verificar que el SKU no exista ya en el catálogo
      const existente = await prisma.producto.findUnique({ where: { sku: item.sku } });
      if (existente) {
        // Solo vincular
        await prisma.historialStockMayorista.update({
          where: { id: item.id },
          data: { productoId: existente.id },
        });
        console.log(`  Vinculado (ya existía): ${item.sku} → ${existente.nombre}`);
        creados++;
        continue;
      }

      const producto = await prisma.producto.create({
        data: {
          sku: item.sku,
          nombre,
          marca: item.tipoProducto ?? "-",
          categoria: item.tipoProducto ?? "Sin categorizar",
          presentacion: "BOLSA_CERRADA",
          unidadMedida: "KILOGRAMOS",
          contenido: 1,
          margenPorcentaje: 30,
          precioCostoUnitario: precioCosto,
          precioVenta: precioCosto * 1.3,
          stockActual: 0,
        },
      });

      await prisma.historialStockMayorista.update({
        where: { id: item.id },
        data: { productoId: producto.id },
      });

      creados++;
      if (creados % 50 === 0) console.log(`  ${creados}/${items.length}...`);
    } catch (e: any) {
      console.error(`  Error en SKU ${item.sku}: ${e.message}`);
      errores++;
    }
  }

  console.log(`\nListo. Creados/vinculados: ${creados}, errores: ${errores}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
