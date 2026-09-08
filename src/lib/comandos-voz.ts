import { prisma } from "@/lib/prisma";

const LIMITE_RESULTADOS = 10;
const SIMILITUD_MINIMA_MARCA = 0.6;

// Distancia de Levenshtein, para comparar la marca transcripta por voz
// (a menudo distorsionada, ej. "Eukanuba" -> "Eujanuba") contra las marcas
// reales cargadas en el catálogo.
function distanciaLevenshtein(a: string, b: string): number {
  const filas = a.length + 1;
  const columnas = b.length + 1;
  const dp: number[][] = Array.from({ length: filas }, () => new Array(columnas).fill(0));
  for (let i = 0; i < filas; i++) dp[i][0] = i;
  for (let j = 0; j < columnas; j++) dp[0][j] = j;
  for (let i = 1; i < filas; i++) {
    for (let j = 1; j < columnas; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + costo);
    }
  }
  return dp[filas - 1][columnas - 1];
}

function similitud(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distanciaLevenshtein(a, b) / maxLen;
}

// Busca, entre las marcas reales del catálogo, la más parecida al texto
// transcripto por voz. Devuelve null si ninguna supera el umbral mínimo.
async function marcaMasParecida(textoMarca: string): Promise<string | null> {
  const marcas = await prisma.producto.findMany({
    where: { activo: true },
    distinct: ["marca"],
    select: { marca: true },
  });

  const objetivo = textoMarca.toLowerCase().trim();
  let mejor: { marca: string; score: number } | null = null;
  for (const { marca } of marcas) {
    const score = similitud(objetivo, marca.toLowerCase());
    if (!mejor || score > mejor.score) mejor = { marca, score };
  }

  return mejor && mejor.score >= SIMILITUD_MINIMA_MARCA ? mejor.marca : null;
}

export type ResultadoComandoVoz = { texto: string } | null;

// Interpreta el texto transcripto de un audio y ejecuta, si matchea, uno de
// los comandos simples soportados. Devuelve null si el texto no matchea
// ningún comando conocido (el caller decide qué hacer, ej. avisar que no
// entendió). Comandos deliberadamente simples (matching de palabras clave,
// no NLU): "buscar alimento para perros/gatos marca X" y "crear venta para
// [cliente]". Confirmar pedido HYM queda siempre manual, no por voz.
export async function ejecutarComandoVoz(textoOriginal: string): Promise<ResultadoComandoVoz> {
  const texto = textoOriginal.toLowerCase().trim();
  if (!texto) return null;

  if (/\b(alimento|comida)\b/.test(texto) || /\bbuscar\b/.test(texto)) {
    return buscarAlimentoPorEspecieYMarca(texto);
  }

  if (/\bvender\b|\bventa\b/.test(texto) && /\bpara\b/.test(texto)) {
    return crearVentaParaCliente(texto);
  }

  return null;
}

async function buscarAlimentoPorEspecieYMarca(texto: string): Promise<ResultadoComandoVoz> {
  const esPerro = /\bperro/.test(texto);
  const esGato = /\bgato/.test(texto);

  const match = texto.match(/marca\s+([a-záéíóúñ0-9\s]+)/i);
  const marcaTranscripta = match?.[1]?.trim();

  if (!esPerro && !esGato && !marcaTranscripta) return null;

  const marca = marcaTranscripta ? await marcaMasParecida(marcaTranscripta) : null;
  if (marcaTranscripta && !marca) {
    return { texto: `🎙 No reconocí la marca "${marcaTranscripta}". Probá repetirla más despacio.` };
  }

  const raizNombre = esPerro ? "Perros" : esGato ? "Gatos" : null;
  const raiz = raizNombre
    ? await prisma.categoriaTiendanube.findFirst({ where: { nombre: raizNombre, parentId: null } })
    : null;

  const productos = await prisma.producto.findMany({
    where: {
      activo: true,
      ...(marca ? { marca } : {}),
      ...(raiz
        ? {
            categoriasTiendanube: {
              some: { categoria: { OR: [{ id: raiz.id }, { parentId: raiz.id }] } },
            },
          }
        : {}),
    },
    take: LIMITE_RESULTADOS,
    orderBy: [{ marca: "asc" }, { nombre: "asc" }],
    select: { nombre: true, nombreTiendanube: true, marca: true, skuInterno: true, stockActual: true, precioVenta: true },
  });

  const etiqueta = [raizNombre, marca ? `marca "${marca}"` : null].filter(Boolean).join(" · ");

  if (productos.length === 0) {
    return { texto: `🎙 No encontré alimentos${etiqueta ? ` de ${etiqueta}` : ""}.` };
  }

  const lineas = productos.map(
    (p) =>
      `<b>${p.nombreTiendanube ?? p.nombre}</b> (${p.marca}) — SKU ${p.skuInterno}\nStock: ${p.stockActual} — $${Number(p.precioVenta).toFixed(2)}`
  );
  return { texto: `🎙 Resultados${etiqueta ? ` (${etiqueta})` : ""}:\n\n${lineas.join("\n\n")}` };
}

async function crearVentaParaCliente(texto: string): Promise<ResultadoComandoVoz> {
  const match = texto.match(/para\s+([a-záéíóúñ\s]+?)(?:\.|$)/i);
  const nombreBuscado = match?.[1]?.trim();
  if (!nombreBuscado) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const clientes = await prisma.cliente.findMany({
    where: {
      OR: [
        { nombre: { contains: nombreBuscado, mode: "insensitive" } },
        { apellido: { contains: nombreBuscado, mode: "insensitive" } },
      ],
    },
    take: 5,
    select: { id: true, nombre: true, apellido: true },
  });

  if (clientes.length === 0) {
    return {
      texto: `🎙 No encontré ningún cliente que coincida con "${nombreBuscado}". Abrí "Nueva venta" y usá "+ Nuevo cliente" para cargarlo.\n${appUrl}/ventas/nueva`,
    };
  }

  if (clientes.length === 1) {
    const c = clientes[0];
    return { texto: `🎙 Cliente encontrado: ${c.nombre} ${c.apellido}. Abrí el link y seleccionalo del combo.\n${appUrl}/ventas/nueva` };
  }

  const lista = clientes.map((c) => `• ${c.nombre} ${c.apellido}`).join("\n");
  return { texto: `🎙 Encontré varios clientes para "${nombreBuscado}":\n${lista}\n\nAbrí el link y elegí el correcto.\n${appUrl}/ventas/nueva` };
}
