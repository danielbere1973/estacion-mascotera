import { prisma } from "@/lib/prisma";
import type { BotonInline } from "@/lib/telegram";

const PRODUCTOS_POR_PAGINA = 8;
const CLIENTES_POR_PAGINA = 5;
// Largo pensado para ocupar el ancho de un mensaje en el celular sin partirse en dos renglones.
const SEPARADOR_PROVEEDORES = "-".repeat(40);

function botonVolver(parentId: number | null): BotonInline[] {
  return [{ text: "◀️ Volver", callback_data: parentId ? `cat:${parentId}` : "cat_root" }];
}

export async function armarNivelRaiz(): Promise<{ texto: string; botones: BotonInline[][] }> {
  const raices = await prisma.categoriaTiendanube.findMany({
    where: { parentId: null, visible: true },
    orderBy: { nombre: "asc" },
  });

  const botones = raices.map((c) => [{ text: c.nombre, callback_data: `cat:${c.id}` }]);
  botones.push([{ text: "👤 Clientes", callback_data: "clientes_lista" }]);
  return { texto: "🗂 Elegí una categoría:", botones };
}

function esCategoriaProveedor(nombre: string): boolean {
  return nombre.trim().toLowerCase().startsWith("proveedor");
}

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function armarInfoProveedores(
  categoriaId: number
): Promise<{ texto: string; botones: BotonInline[][] }> {
  const proveedores = await prisma.proveedor.findMany({ orderBy: { nombre: "asc" } });
  const botones = [[{ text: "◀️ Volver", callback_data: `cat:${categoriaId}` }]];

  if (proveedores.length === 0) {
    return { texto: "ℹ️ No hay proveedores cargados todavía.", botones };
  }

  const bloques = proveedores.map((p) =>
    [
      `<b>Proveedor:</b> ${escaparHtml(p.nombre)}`,
      `<b>Teléfono:</b> ${escaparHtml(p.contacto ?? "-")}`,
      `<b>Dirección:</b> ${
        p.direccion
          ? `<a href="https://waze.com/ul?q=${encodeURIComponent(p.direccion)}&navigate=yes">${escaparHtml(p.direccion)}</a>`
          : "-"
      }`,
      `<b>Account Manager:</b> ${escaparHtml(p.accountManager ?? "-")}`,
      `<b>Horarios:</b> ${escaparHtml(p.horarios ?? "-")}`,
    ].join("\n")
  );

  return { texto: `ℹ️ <b>Información de proveedores</b>\n\n${bloques.join(`\n${SEPARADOR_PROVEEDORES}\n`)}`, botones };
}

export async function armarListaClientes(pagina: number = 1): Promise<{ texto: string; botones: BotonInline[][] }> {
  const skip = (pagina - 1) * CLIENTES_POR_PAGINA;
  const clientes = await prisma.cliente.findMany({
    orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
    include: { _count: { select: { ventas: true } } },
    skip,
    take: CLIENTES_POR_PAGINA + 1,
  });

  const hayMas = clientes.length > CLIENTES_POR_PAGINA;
  const paginaClientes = clientes.slice(0, CLIENTES_POR_PAGINA);

  if (paginaClientes.length === 0) {
    return {
      texto: pagina === 1 ? "👤 No hay clientes cargados todavía." : "👤 No hay más clientes.",
      botones: [botonVolver(null)],
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const lineas = paginaClientes.map(
    (c) =>
      `<b>${c.nombre} ${c.apellido}</b>\n📞 ${c.telefono}\n✉️ ${c.email ?? "-"}\n📍 <a href="https://waze.com/ul?q=${encodeURIComponent(c.direccion)}&navigate=yes">${c.direccion}</a>\n🛒 Ventas: <a href="${appUrl}/clientes/${c.id}">${c._count.ventas}</a>`
  );

  const filaPaginacion: BotonInline[] = [];
  if (pagina > 1) filaPaginacion.push({ text: "⬅️ Anterior", callback_data: `clientes_lista:${pagina - 1}` });
  if (hayMas) filaPaginacion.push({ text: "➡️ Siguiente", callback_data: `clientes_lista:${pagina + 1}` });

  const botones: BotonInline[][] = [];
  if (filaPaginacion.length > 0) botones.push(filaPaginacion);
  botones.push(botonVolver(null));

  return { texto: `👤 <b>Clientes</b>\n\n${lineas.join("\n\n")}`, botones };
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
    if (esCategoriaProveedor(categoria.nombre)) {
      botones.push([{ text: "ℹ️ Información", callback_data: `prov_info:${categoria.id}` }]);
    }
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
