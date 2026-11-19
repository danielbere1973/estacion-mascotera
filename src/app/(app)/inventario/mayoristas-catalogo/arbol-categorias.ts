import type { CategoriaTN } from "@/lib/tiendanube";

export type NodoCategoria = { id: number; nombre: string; cantidad: number; hijas: NodoCategoria[] };

// Raíces internas de Tiendanube que no son para clientes (igual criterio que el bot de Telegram).
function esRaizInterna(nombre: string): boolean {
  const n = nombre.trim().toLowerCase();
  return n === "fotos" || n.startsWith("proveedor");
}

const nombreDe = (c: CategoriaTN) => c.name.es?.trim() || `Categoría ${c.id}`;

// Orden fijo de las ramas principales; las que no están acá van después, en orden alfabético.
const ORDEN_RAICES = ["gatos", "perros", "marcas", "promociones"];
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const posicionRaiz = (nombre: string) => {
  const i = ORDEN_RAICES.indexOf(normalizar(nombre));
  return i === -1 ? ORDEN_RAICES.length : i;
};

// Árbol de categorías de Tiendanube armado solo con las ramas que tienen productos del listado.
// Un producto cuenta en su categoría y en todas sus ancestras, así al cliquear una rama
// aparecen también los productos de sus sub-ramas.
export function armarArbolCategorias<T extends { categorias: number[] }>(categorias: CategoriaTN[], productos: T[]) {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const padreDe = (c: CategoriaTN) => (c.parent && porId.has(c.parent) ? c.parent : null);

  // Ids ancestros (incluida la propia) de una categoría, de la hoja a la raíz.
  const caminoCache = new Map<number, number[]>();
  const camino = (id: number): number[] => {
    const enCache = caminoCache.get(id);
    if (enCache) return enCache;
    const ids: number[] = [];
    let actual = porId.get(id);
    while (actual && !ids.includes(actual.id)) {
      ids.push(actual.id);
      const padre = padreDe(actual);
      actual = padre != null ? porId.get(padre) : undefined;
    }
    caminoCache.set(id, ids);
    return ids;
  };

  const ocultas = new Set(
    categorias.filter((c) => padreDe(c) == null && esRaizInterna(nombreDe(c))).map((c) => c.id)
  );
  const esVisible = (id: number) => {
    const ids = camino(id);
    return ids.length > 0 && !ocultas.has(ids[ids.length - 1]);
  };

  // Categorías (con ancestras) de cada producto.
  const categoriasDeProducto = new Map<T, Set<number>>();
  const cantidad = new Map<number, number>();
  for (const p of productos) {
    const ids = new Set(p.categorias.filter(esVisible).flatMap(camino));
    categoriasDeProducto.set(p, ids);
    for (const id of ids) cantidad.set(id, (cantidad.get(id) ?? 0) + 1);
  }

  const hijasDe = new Map<number | null, CategoriaTN[]>();
  for (const c of categorias) {
    if (!cantidad.get(c.id)) continue;
    const padre = padreDe(c);
    hijasDe.set(padre, [...(hijasDe.get(padre) ?? []), c]);
  }
  const armar = (padre: number | null): NodoCategoria[] =>
    (hijasDe.get(padre) ?? [])
      .map((c) => ({ id: c.id, nombre: nombreDe(c), cantidad: cantidad.get(c.id) ?? 0, hijas: armar(c.id) }))
      .sort(
        (a, b) =>
          (padre == null ? posicionRaiz(a.nombre) - posicionRaiz(b.nombre) : 0) ||
          a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
      );

  return {
    raices: armar(null),
    // Categorías visibles del producto con todas sus ancestras: filtrar por una rama es ver si la incluye.
    categoriasDe: (p: T) => [...(categoriasDeProducto.get(p) ?? [])],
  };
}

// Ids desde la raíz hasta la categoría (vacío si no está en el árbol).
export function rutaEnArbol(raices: NodoCategoria[], id: number): NodoCategoria[] {
  for (const nodo of raices) {
    if (nodo.id === id) return [nodo];
    const resto = rutaEnArbol(nodo.hijas, id);
    if (resto.length > 0) return [nodo, ...resto];
  }
  return [];
}
