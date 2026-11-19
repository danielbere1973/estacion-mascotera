const USER_AGENT = "Sistema-EM-Sync (danielbere@gmail.com)";

export type CategoriaTN = {
  id: number;
  name: { es?: string };
  parent: number | null;
};

export type VarianteTN = {
  id: number;
  sku: string | null;
  values?: { es?: string }[]; // valores de la variante, ej. [{ es: "15 kg" }]
};

export type ImagenTN = {
  id: number;
  src: string;
};

export type ProductoTN = {
  id: number;
  name: { es?: string };
  variants: VarianteTN[];
  categories: { id: number; name: { es?: string } }[];
  images?: ImagenTN[];
};

async function tiendanubeFetch<T>(storeId: string, accessToken: string, path: string): Promise<T> {
  const res = await fetch(`https://api.tiendanube.com/v1/${storeId}${path}`, {
    headers: { Authentication: `bearer ${accessToken}`, "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Error Tiendanube ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

// No pagina: hoy hay 68 categorías, per_page=100 alcanza. Si el árbol crece
// por encima de 100 hay que agregarle paginación igual que a los productos.
export async function traerCategoriasTiendanube(storeId: string, accessToken: string): Promise<CategoriaTN[]> {
  return tiendanubeFetch<CategoriaTN[]>(storeId, accessToken, "/categories?per_page=100");
}

export async function traerProductosTiendanube(storeId: string, accessToken: string): Promise<ProductoTN[]> {
  const productos: ProductoTN[] = [];
  let page = 1;
  const perPage = 50;
  while (true) {
    const data = await tiendanubeFetch<ProductoTN[]>(storeId, accessToken, `/products?page=${page}&per_page=${perPage}`);
    if (data.length === 0) break;
    productos.push(...data);
    if (data.length < perPage) break;
    page++;
  }
  return productos;
}

export type DatosTN = { nombre: string | null; foto: string | null };

// Nombre y foto principal de Tiendanube por SKU (en mayúsculas). Si el producto tiene
// varias variantes, el nombre lleva los valores de la variante: "Nombre - 15 kg".
export async function traerDatosPorSkuTiendanube(storeId: string, accessToken: string): Promise<Map<string, DatosTN>> {
  const productos = await traerProductosTiendanube(storeId, accessToken);
  const datosPorSku = new Map<string, DatosTN>();
  for (const producto of productos) {
    const foto = producto.images?.[0]?.src ?? null;
    const nombreProducto = producto.name?.es?.trim() || null;
    for (const variante of producto.variants) {
      const sku = variante.sku?.trim().toUpperCase();
      if (!sku || datosPorSku.has(sku)) continue;
      const valores = (variante.values ?? []).map((v) => v.es?.trim()).filter(Boolean).join(" / ");
      const nombre =
        nombreProducto && valores && producto.variants.length > 1 ? `${nombreProducto} - ${valores}` : nombreProducto;
      datosPorSku.set(sku, { nombre, foto });
    }
  }
  return datosPorSku;
}
