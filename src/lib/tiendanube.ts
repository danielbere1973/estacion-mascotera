const USER_AGENT = "Sistema-EM-Sync (danielbere@gmail.com)";

export type CategoriaTN = {
  id: number;
  name: { es?: string };
  parent: number | null;
};

export type VarianteTN = {
  id: number;
  sku: string | null;
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

// Foto principal por skuInterno (primera imagen de la primera variante que matchea ese SKU).
export async function traerFotosPorSkuTiendanube(storeId: string, accessToken: string): Promise<Map<string, string>> {
  const productos = await traerProductosTiendanube(storeId, accessToken);
  const fotoPorSku = new Map<string, string>();
  for (const producto of productos) {
    const foto = producto.images?.[0]?.src;
    if (!foto) continue;
    for (const variante of producto.variants) {
      const sku = variante.sku?.trim().toUpperCase();
      if (sku && !fotoPorSku.has(sku)) fotoPorSku.set(sku, foto);
    }
  }
  return fotoPorSku;
}
