import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HYM_ID = 5;

function parsearTamanio(tamanio: string): { contenido: number; unidad: string } | null {
  const t = tamanio.trim();
  if (!t) return null;

  const matchKg = t.match(/^([\d.]+)\s*[Kk][Gg]$/);
  if (matchKg) return { contenido: Number(matchKg[1]), unidad: "KILOGRAMOS" };

  const matchLt = t.match(/^([\d.]+)\s*[Ll][Tt]$/);
  if (matchLt) return { contenido: Number(matchLt[1]), unidad: "LITROS" };

  const matchNum = t.match(/^([\d.]+)$/);
  if (matchNum) {
    const val = Number(matchNum[1]);
    if (val < 1) return { contenido: Math.round(val * 1000), unidad: "GRAMOS" };
    return { contenido: val, unidad: "KILOGRAMOS" };
  }

  return null;
}

async function main() {
  const items = await prisma.historialStockMayorista.findMany({
    where: { proveedorId: HYM_ID, productoId: { not: null }, tamanios: { not: null } },
    select: { productoId: true, tamanios: true, sku: true },
  });

  console.log(`Procesando ${items.length} items de HYM con tamaño...`);

  let actualizados = 0;
  let sinParsear = 0;
  let errores = 0;

  for (const item of items) {
    const parsed = parsearTamanio(item.tamanios ?? "");
    if (!parsed) {
      console.log(`  Sin parsear: SKU ${item.sku} tamaño="${item.tamanios}"`);
      sinParsear++;
      continue;
    }

    try {
      await prisma.producto.update({
        where: { id: item.productoId! },
        data: {
          contenido: parsed.contenido,
          unidadMedida: parsed.unidad as any,
        },
      });
      actualizados++;
    } catch (e) {
      console.error(`  Error en productoId ${item.productoId} (SKU ${item.sku}):`, e);
      errores++;
    }
  }

  console.log(`\nListo: ${actualizados} actualizados, ${sinParsear} sin parsear, ${errores} errores`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
