import { prisma } from "../src/lib/prisma";
import { traerCategoriasTiendanube, traerProductosTiendanube } from "../src/lib/tiendanube";

// Sincroniza el árbol de categorías de Tiendanube (CategoriaTiendanube) y los
// vínculos producto-categoría (ProductoCategoriaTiendanube), matcheando por
// skuInterno contra las variantes de Tiendanube (mismo mecanismo que
// completar-nombre-tiendanube.ts). No toca Producto.categoria (campo local,
// desacoplado). DRY_RUN=1 (default) solo imprime el plan.

// Raíces que no deben mostrarse como botón en el bot de Telegram (internas /
// no destinadas a clientes), pero que igual quedan sincronizadas en la base.
const RAICES_NO_VISIBLES = new Set(["fotos"]);

async function main() {
  const config = await prisma.tiendanubeConfig.findFirst();
  if (!config) throw new Error("No hay tienda de Tiendanube autorizada.");

  console.log("Consultando árbol de categorías de Tiendanube...");
  const categoriasTN = await traerCategoriasTiendanube(config.storeId, config.accessToken);
  console.log(`Categorías traídas: ${categoriasTN.length}`);

  const idsValidos = new Set(categoriasTN.map((c) => c.id));
  const huerfanas = categoriasTN.filter((c) => c.parent && c.parent !== 0 && !idsValidos.has(c.parent));
  if (huerfanas.length > 0) {
    console.log(`ADVERTENCIA: ${huerfanas.length} categorías con parent inexistente:`);
    for (const h of huerfanas) console.log(`  ${h.id} "${h.name.es}" parent=${h.parent}`);
  }

  console.log("\nConsultando catálogo de productos de Tiendanube...");
  const productosTN = await traerProductosTiendanube(config.storeId, config.accessToken);
  console.log(`Productos traídos: ${productosTN.length}`);

  const productosLocales = await prisma.producto.findMany({ select: { id: true, skuInterno: true } });
  const idPorSku = new Map(productosLocales.map((p) => [p.skuInterno.toUpperCase(), p.id]));

  const vinculos = new Map<string, { productoId: number; categoriaId: number }>();
  let productosConVinculo = 0;
  const skusVinculados = new Set<string>();

  for (const p of productosTN) {
    const skusProducto = p.variants.map((v) => v.sku?.trim().toUpperCase()).filter((s): s is string => !!s);
    const productoIdsLocales = new Set(skusProducto.map((sku) => idPorSku.get(sku)).filter((id): id is number => id !== undefined));

    if (productoIdsLocales.size > 0) {
      for (const sku of skusProducto) if (idPorSku.has(sku)) skusVinculados.add(sku);
    }

    for (const productoId of productoIdsLocales) {
      for (const cat of p.categories) {
        vinculos.set(`${productoId}:${cat.id}`, { productoId, categoriaId: cat.id });
      }
    }
  }
  productosConVinculo = skusVinculados.size;

  console.log(`\nProductos locales con vínculo a Tiendanube (por SKU): ${productosConVinculo} de ${productosLocales.length}`);
  console.log(`Vínculos producto-categoría a aplicar: ${vinculos.size}`);

  const existentes = await prisma.productoCategoriaTiendanube.findMany({ select: { productoId: true, categoriaId: true } });
  const clavesExistentes = new Set(existentes.map((e) => `${e.productoId}:${e.categoriaId}`));
  const clavesDeseadas = new Set(vinculos.keys());

  const altas = [...clavesDeseadas].filter((k) => !clavesExistentes.has(k));
  const bajas = [...clavesExistentes].filter((k) => !clavesDeseadas.has(k));
  console.log(`Altas: ${altas.length} | Bajas: ${bajas.length}`);

  const DRY_RUN = process.env.DRY_RUN !== "0";
  if (DRY_RUN) {
    console.log("\n=== DRY RUN: no se escribió nada. Correr con DRY_RUN=0 para aplicar. ===");
    return;
  }

  console.log("\n=== APLICANDO CAMBIOS ===");

  for (const cat of categoriasTN) {
    await prisma.categoriaTiendanube.upsert({
      where: { id: cat.id },
      create: {
        id: cat.id,
        nombre: cat.name.es ?? `Categoría ${cat.id}`,
        parentId: cat.parent && cat.parent !== 0 ? cat.parent : null,
        visible: !RAICES_NO_VISIBLES.has((cat.name.es ?? "").trim().toLowerCase()),
      },
      update: {
        nombre: cat.name.es ?? `Categoría ${cat.id}`,
        parentId: cat.parent && cat.parent !== 0 ? cat.parent : null,
      },
    });
  }
  console.log(`Categorías sincronizadas: ${categoriasTN.length}`);

  if (bajas.length > 0) {
    await prisma.$transaction(
      bajas.map((k) => {
        const [productoId, categoriaId] = k.split(":").map(Number);
        return prisma.productoCategoriaTiendanube.delete({ where: { productoId_categoriaId: { productoId, categoriaId } } });
      }),
    );
  }
  if (altas.length > 0) {
    await prisma.productoCategoriaTiendanube.createMany({
      data: altas.map((k) => {
        const [productoId, categoriaId] = k.split(":").map(Number);
        return { productoId, categoriaId };
      }),
      skipDuplicates: true,
    });
  }
  console.log(`Vínculos aplicados. Altas: ${altas.length} | Bajas: ${bajas.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
