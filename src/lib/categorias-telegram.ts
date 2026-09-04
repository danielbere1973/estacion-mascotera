import { prisma } from "@/lib/prisma";
import type { BotonInline } from "@/lib/telegram";

const PRODUCTOS_POR_PAGINA = 8;

function botonVolver(parentId: number | null): BotonInline[] {
  return [{ text: "◀️ Volver", callback_data: parentId ? `cat:${parentId}` : "cat_root" }];
}

export async function armarNivelRaiz(): Promise<{ texto: string; botones: BotonInline[][] }> {
  const raices = await prisma.categoriaTiendanube.findMany({
    where: { parentId: null, visible: true },
    orderBy: { nombre: "asc" },
  });

  const botones = raices.map((c) => [{ text: c.nombre, callback_data: `cat:${c.id}` }]);
  return { texto: "🗂 Elegí una categoría:", botones };
}

export async function armarNivelCategoria(
  categoriaId: number,
  pagina: number = 1
): Promise<{ texto: string; botones: BotonInline[][] } | null> {
  const categoria = await prisma.categoriaTiendanube.findUnique({ where: { id: categoriaId } });
  if (!categoria) return null;

  const hijas = await prisma.categoriaTiendanube.findMany({
    where: { parentId: categoriaId, visible: true },
    orderBy: { nombre: "asc" },
  });

  if (hijas.length > 0) {
    const botones = hijas.map((c) => [{ text: c.nombre, callback_data: `cat:${c.id}` }]);
    botones.push(botonVolver(categoria.parentId));
    return { texto: `🗂 <b>${categoria.nombre}</b>`, botones };
  }

  return armarNivelHoja(categoria.id, categoria.nombre, categoria.parentId, pagina);
}

async function armarNivelHoja(
  categoriaId: number,
  nombreCategoria: string,
  parentId: number | null,
  pagina: number
): Promise<{ texto: string; botones: BotonInline[][] }> {
  const skip = (pagina - 1) * PRODUCTOS_POR_PAGINA;
  const vinculos = await prisma.productoCategoriaTiendanube.findMany({
    where: { categoriaId, producto: { activo: true } },
    include: {
      producto: {
        select: { nombre: true, nombreTiendanube: true, marca: true, skuInterno: true, stockActual: true, precioVenta: true },
      },
    },
    orderBy: [{ producto: { marca: "asc" } }, { producto: { nombre: "asc" } }],
    skip,
    take: PRODUCTOS_POR_PAGINA + 1,
  });

  const hayMas = vinculos.length > PRODUCTOS_POR_PAGINA;
  const productos = vinculos.slice(0, PRODUCTOS_POR_PAGINA).map((v) => v.producto);

  if (productos.length === 0) {
    return {
      texto: `🗂 <b>${nombreCategoria}</b>\n\nTodavía no hay productos de esta categoría cargados en el sistema. Podés buscarlos por nombre escribiendo directamente.`,
      botones: [botonVolver(parentId)],
    };
  }

  const lineas = productos.map(
    (p) =>
      `<b>${p.nombreTiendanube ?? p.nombre}</b> (${p.marca}) — SKU ${p.skuInterno}\nStock: ${p.stockActual} — $${Number(p.precioVenta).toFixed(2)}`
  );

  const filaPaginacion: BotonInline[] = [];
  if (pagina > 1) filaPaginacion.push({ text: "⬅️ Anterior", callback_data: `cat:${categoriaId},${pagina - 1}` });
  if (hayMas) filaPaginacion.push({ text: "➡️ Siguiente", callback_data: `cat:${categoriaId},${pagina + 1}` });

  const botones: BotonInline[][] = [];
  if (filaPaginacion.length > 0) botones.push(filaPaginacion);
  botones.push(botonVolver(parentId));

  return { texto: `🗂 <b>${nombreCategoria}</b>\n\n${lineas.join("\n\n")}`, botones };
}
