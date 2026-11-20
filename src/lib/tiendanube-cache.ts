import { unstable_cache } from "next/cache";
import { traerCategoriasTiendanube, traerDatosPorSkuTiendanube, type CategoriaTN, type DatosTN } from "@/lib/tiendanube";

// Versiones cacheadas por 10 minutos de lo que el Catálogo mayorista lee de Tiendanube
// (nombre, foto y categorías). Traer el catálogo entero tarda varios segundos; con esto
// solo se paga cada 10 minutos. Los cambios en Tiendanube tardan hasta 10 minutos en verse;
// precio y stock no salen de acá (vienen de la base) y siguen al momento.
// Archivo aparte de tiendanube.ts porque ese lo usan también scripts que corren fuera de Next.
// Si una consulta falla no se cachea: se reintenta en la próxima carga.
const DIEZ_MINUTOS = 600;
// Etiqueta de estas cachés: forzarActualizacionTiendanube (Mayorista › Tipo mayorista) la invalida.
export const TAG_CACHE_TIENDANUBE = "tiendanube";

// unstable_cache guarda el resultado como JSON: el Map viaja como lista de pares.
const datosPorSkuCacheado = unstable_cache(
  async (storeId: string, accessToken: string) => [...(await traerDatosPorSkuTiendanube(storeId, accessToken))],
  ["tiendanube-datos-por-sku"],
  { revalidate: DIEZ_MINUTOS, tags: [TAG_CACHE_TIENDANUBE] }
);

export async function traerDatosPorSkuTiendanubeCacheado(storeId: string, accessToken: string): Promise<Map<string, DatosTN>> {
  return new Map(await datosPorSkuCacheado(storeId, accessToken));
}

export const traerCategoriasTiendanubeCacheado: (storeId: string, accessToken: string) => Promise<CategoriaTN[]> =
  unstable_cache(traerCategoriasTiendanube, ["tiendanube-categorias"], {
    revalidate: DIEZ_MINUTOS,
    tags: [TAG_CACHE_TIENDANUBE],
  });
