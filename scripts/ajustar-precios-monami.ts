/**
 * Aplica a todos los productos del proveedor Mon Ami:
 *   precioCostoUnitario = precioLista * (1 - 0.15) * (1 + 0.21)
 *   precioVenta = precioCostoUnitario * (1 + margen/100)
 *
 * Ejecutar con: npx tsx scripts/ajustar-precios-monami.ts
 */

import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // Buscar proveedor Mon Ami
  const monami = await db.proveedor.findFirst({
    where: { nombre: { contains: "Mon Ami", mode: "insensitive" } },
  });

  if (!monami) {
    console.error("No se encontró el proveedor Mon Ami. Crealo primero en el sistema.");
    return;
  }

  console.log(`Proveedor: ${monami.nombre} (id=${monami.id})`);

  // Buscar todos los productos de este proveedor
  const productos = await db.producto.findMany({
    where: { proveedorId: monami.id },
  });

  if (productos.length === 0) {
    // Alternativa: buscar por SKU en historialStockMayorista y cruzar con Producto
    console.log("No hay productos vinculados directamente a Mon Ami.");
    console.log("Buscando por lista de precios...");

    const historial = await db.historialStockMayorista.findMany({
      where: { proveedorId: monami.id },
      include: { producto: true },
      orderBy: { fechaImportacion: "desc" },
    });

    const vistos = new Set<number>();
    const productosViaHistorial = historial
      .filter(h => h.producto && !vistos.has(h.productoId!) && vistos.add(h.productoId!))
      .map(h => h.producto!);

    if (productosViaHistorial.length === 0) {
      console.log("Tampoco hay productos en la lista de Mon Ami.");
      return;
    }

    console.log(`Encontrados ${productosViaHistorial.length} productos vía historial.\n`);
    await ajustar(productosViaHistorial);
    return;
  }

  console.log(`Encontrados ${productos.length} productos.\n`);
  await ajustar(productos);
}

async function ajustar(productos: { id: number; nombre: string; precioCostoUnitario: any; margenPorcentaje: any }[]) {
  let actualizados = 0;

  for (const p of productos) {
    const precioOriginal = Number(p.precioCostoUnitario);
    const nuevoCosto = precioOriginal * (1 - 0.15) * (1 + 0.21);
    const nuevoPrecioVenta = nuevoCosto * (1 + Number(p.margenPorcentaje) / 100);

    await db.producto.update({
      where: { id: p.id },
      data: {
        precioCostoUnitario: nuevoCosto,
        precioVenta: nuevoPrecioVenta,
      },
    });

    console.log(
      `${p.nombre}: $${precioOriginal.toFixed(2)} → costo $${nuevoCosto.toFixed(2)} | venta $${nuevoPrecioVenta.toFixed(2)}`
    );
    actualizados++;
  }

  console.log(`\n✅ ${actualizados} productos actualizados.`);
}

main().catch(console.error).finally(() => db.$disconnect());
