"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { AgregarAlCarrito } from "./carrito";
import { maximoPorEstado, type EstadoStockCatalogo } from "./limites";
import { rutaEnArbol, type NodoCategoria } from "./arbol-categorias";
import { PanelCategorias } from "./panel-categorias";

export type ProductoCatalogo = {
  id: number;
  nombre: string;
  marca: string;
  tipo: string;
  precioMayorista: number | null;
  estadoStock: EstadoStockCatalogo | null;
  foto: string | null;
  // Categorías del producto con sus ancestras (ver armarArbolCategorias).
  categorias: number[];
};

// La categoría elegida vive en la URL (?cat=) para que funcionen "atrás" y los links,
// pero se cambia con history.pushState: filtra en el navegador sin volver al servidor
// (cada ida al servidor vuelve a traer todo el catálogo de Tiendanube).
function useCategoriaElegida(): [number | null, (id: number | null) => void] {
  const searchParams = useSearchParams();
  const cat = searchParams.get("cat");
  const elegida = cat && /^\d+$/.test(cat) ? Number(cat) : null;
  const elegir = (id: number | null) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (id != null) sp.set("cat", String(id));
    else sp.delete("cat");
    const qs = sp.toString();
    window.history.pushState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };
  return [elegida, elegir];
}

// Para el formulario de búsqueda (que es del servidor): conserva la categoría al buscar
// y muestra "Limpiar" si hay algún filtro.
export function ExtrasBusqueda({ hayBusqueda }: { hayBusqueda: boolean }) {
  const [elegida] = useCategoriaElegida();
  return (
    <>
      {elegida != null && <input type="hidden" name="cat" value={elegida} />}
      {(hayBusqueda || elegida != null) && (
        <a
          href="/inventario/mayoristas-catalogo"
          className="rounded-md border border-gray-200 px-4 py-2 text-center text-sm text-gray-500 hover:bg-gray-50"
        >
          Limpiar
        </a>
      )}
    </>
  );
}

export function CatalogoProductos({
  raices,
  productos,
  puedeComprar,
}: {
  raices: NodoCategoria[];
  productos: ProductoCatalogo[];
  puedeComprar: boolean;
}) {
  const [elegida, elegir] = useCategoriaElegida();
  // Si la categoría de la URL no está en el árbol (ej. la búsqueda la dejó sin productos), se ignora.
  const ruta = useMemo(() => (elegida != null ? rutaEnArbol(raices, elegida) : []), [raices, elegida]);
  const listado = useMemo(
    () => (ruta.length > 0 ? productos.filter((p) => p.categorias.includes(ruta[ruta.length - 1].id)) : productos),
    [productos, ruta]
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <PanelCategorias raices={raices} ruta={ruta.map((n) => n.id)} onElegir={elegir} />

      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-xs text-gray-400">
          {ruta.length > 0 && <span className="text-gray-600">{ruta.map((n) => n.nombre).join(" › ")} · </span>}
          {listado.length} producto{listado.length !== 1 ? "s" : ""}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {listado.map((p) => (
            <div key={p.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-md bg-gray-100">
                {p.foto ? (
                  <Image src={p.foto} alt={p.nombre} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">Sin foto</div>
                )}
              </div>
              <p className="text-xs text-gray-400">{p.marca}</p>
              <p className="text-sm font-medium text-gray-900 leading-snug">{p.nombre}</p>
              <p className="mt-1 text-xs text-gray-400">{p.tipo}</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {p.precioMayorista != null ? formatCurrency(p.precioMayorista) : "—"}
              </p>
              {p.estadoStock && (
                <p className={`text-xs ${p.estadoStock === "Stock disponible" ? "text-green-600" : "text-amber-600"}`}>
                  {p.estadoStock}
                </p>
              )}
              {puedeComprar && p.precioMayorista != null && (
                <div className="mt-auto">
                  <AgregarAlCarrito
                    producto={{
                      productoId: p.id,
                      nombre: p.nombre,
                      marca: p.marca,
                      foto: p.foto,
                      precio: p.precioMayorista,
                      maximo: maximoPorEstado(p.estadoStock),
                    }}
                  />
                </div>
              )}
            </div>
          ))}
          {listado.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-gray-400">No hay productos que coincidan.</p>
          )}
        </div>
      </div>
    </div>
  );
}
