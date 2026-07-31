import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Buscar productos con skuInterno que NO cumple el formato AA00
  const invalidos = await prisma.producto.findMany({
    where: { skuInterno: { not: null } },
    select: { id: true, skuInterno: true, nombre: true },
  });

  const conFormatoInvalido = invalidos.filter(
    (p) => p.skuInterno && !/^[A-Z]{2}\d{2}$/.test(p.skuInterno)
  );

  console.log(`Productos con SKU interno inválido: ${conFormatoInvalido.length}`);
  for (const p of conFormatoInvalido) {
    console.log(`  id=${p.id} skuInterno="${p.skuInterno}" nombre="${p.nombre}"`);
  }

  if (conFormatoInvalido.length === 0) {
    console.log("Nada que corregir.");
    return;
  }

  // El último válido asignado fue AJ06, el siguiente es AJ07
  // Calculamos dinámicamente el siguiente al máximo actual válido
  const validos = invalidos.filter((p) => p.skuInterno && /^[A-Z]{2}\d{2}$/.test(p.skuInterno));
  validos.sort((a, b) => (b.skuInterno! > a.skuInterno! ? 1 : -1));
  let actual = validos[0]?.skuInterno ?? "AA00";

  for (const p of conFormatoInvalido) {
    // Incrementar
    const letras = actual.slice(0, 2);
    const num = parseInt(actual.slice(2), 10);
    if (num < 99) {
      actual = `${letras}${String(num + 1).padStart(2, "0")}`;
    } else {
      const l2 = letras[1];
      const l1 = letras[0];
      if (l2 < "Z") actual = `${l1}${String.fromCharCode(l2.charCodeAt(0) + 1)}00`;
      else actual = `${String.fromCharCode(l1.charCodeAt(0) + 1)}A00`;
    }

    await prisma.producto.update({ where: { id: p.id }, data: { skuInterno: actual } });
    console.log(`  Asignado ${actual} a id=${p.id} "${p.nombre}"`);
  }

  console.log("Listo.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
