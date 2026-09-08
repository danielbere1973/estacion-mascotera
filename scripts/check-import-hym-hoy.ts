import { prisma } from "../src/lib/prisma";

// Solo lectura: revisa qué pasó en la última importación de HYM (hoy).
// No modifica nada.

async function main() {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const proveedor = await prisma.proveedor.findFirst({ where: { nombre: { equals: "HYM", mode: "insensitive" } } });
  if (!proveedor) {
    console.log("No se encontró el proveedor HYM.");
    return;
  }

  const productosCreadosHoy = await prisma.producto.findMany({
    where: { createdAt: { gte: inicioHoy } },
    select: { id: true, skuInterno: true, nombre: true, marca: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Productos creados hoy: ${productosCreadosHoy.length}`);
  for (const p of productosCreadosHoy) {
    console.log(`  #${p.id} [${p.skuInterno}] ${p.nombre} (${p.marca}) - ${p.createdAt.toISOString()}`);
  }

  const historialHoy = await prisma.historialStockMayorista.findMany({
    where: { proveedorId: proveedor.id, fechaImportacion: { gte: inicioHoy } },
    select: { sku: true, codigoHym: true, productoId: true, nombre: true },
  });
  console.log(`\nFilas de HistorialStockMayorista de HYM importadas hoy: ${historialHoy.length}`);
  console.log(`  con productoId: ${historialHoy.filter((h) => h.productoId).length}`);
  console.log(`  sin productoId: ${historialHoy.filter((h) => !h.productoId).length}`);

  // Posibles duplicados: mismo nombre normalizado, distinto id, creado hoy o no.
  const nombreCount = new Map<string, { id: number; skuInterno: string; nombre: string }[]>();
  const todos = await prisma.producto.findMany({
    where: { activo: true },
    select: { id: true, skuInterno: true, nombre: true },
  });
  for (const p of todos) {
    const key = p.nombre.trim().toUpperCase().replace(/\s+/g, " ");
    if (!nombreCount.has(key)) nombreCount.set(key, []);
    nombreCount.get(key)!.push(p);
  }
  const duplicadosPorNombre = [...nombreCount.entries()].filter(([, arr]) => arr.length > 1);
  console.log(`\nGrupos de nombre exactamente duplicado (activos): ${duplicadosPorNombre.length}`);
  for (const [nombre, arr] of duplicadosPorNombre.slice(0, 30)) {
    console.log(`  "${nombre}" -> ${arr.map((p) => `#${p.id}(${p.skuInterno})`).join(", ")}`);
  }
  if (duplicadosPorNombre.length > 30) console.log(`  ... y ${duplicadosPorNombre.length - 30} más`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
