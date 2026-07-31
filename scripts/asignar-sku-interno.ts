import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function siguienteSkuInterno(ultimo: string | null): string {
  if (!ultimo || !/^[A-Z]{2}\d{2}$/.test(ultimo)) return "AA00";

  const letras = ultimo.slice(0, 2);
  const num = parseInt(ultimo.slice(2), 10);

  if (num < 99) return `${letras}${String(num + 1).padStart(2, "0")}`;

  const l2 = letras[1];
  const l1 = letras[0];
  if (l2 < "Z") return `${l1}${String.fromCharCode(l2.charCodeAt(0) + 1)}00`;
  if (l1 < "Z") return `${String.fromCharCode(l1.charCodeAt(0) + 1)}A00`;

  throw new Error("Se agotaron los SKU internos (ZZ99).");
}

async function main() {
  // Obtener el último skuInterno ya asignado
  const ultimoProducto = await prisma.producto.findFirst({
    where: { skuInterno: { not: null } },
    orderBy: { skuInterno: "desc" },
    select: { skuInterno: true },
  });

  let actual = ultimoProducto?.skuInterno ?? null;
  console.log(`Último SKU interno en DB: ${actual ?? "(ninguno)"}`);

  // Obtener todos los productos sin skuInterno, ordenados por id
  const sinSku = await prisma.producto.findMany({
    where: { skuInterno: null },
    orderBy: { id: "asc" },
    select: { id: true, nombre: true, sku: true },
  });

  console.log(`Productos sin SKU interno: ${sinSku.length}`);
  if (sinSku.length === 0) {
    console.log("Nada que hacer.");
    return;
  }

  let actualizados = 0;
  for (const p of sinSku) {
    actual = siguienteSkuInterno(actual);
    await prisma.producto.update({
      where: { id: p.id },
      data: { skuInterno: actual },
    });
    actualizados++;
    if (actualizados % 100 === 0) console.log(`  ${actualizados}/${sinSku.length}...`);
  }

  console.log(`\nListo: ${actualizados} productos actualizados. Último SKU asignado: ${actual}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
