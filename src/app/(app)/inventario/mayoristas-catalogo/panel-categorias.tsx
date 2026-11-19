"use client";

import { useState } from "react";
import Link from "next/link";
import type { NodoCategoria } from "./arbol-categorias";

type Props = {
  raices: NodoCategoria[];
  // Ids desde la raíz hasta la categoría elegida (vacío si no hay ninguna).
  ruta: number[];
  // Parámetros de búsqueda a conservar al cambiar de categoría (q, tipo).
  params: Record<string, string>;
};

function hrefCategoria(params: Record<string, string>, categoriaId: number | null) {
  const sp = new URLSearchParams(params);
  if (categoriaId != null) sp.set("cat", String(categoriaId));
  const qs = sp.toString();
  return `/inventario/mayoristas-catalogo${qs ? `?${qs}` : ""}`;
}

function Chevron({ abierta, visible }: { abierta: boolean; visible: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${abierta ? "rotate-90" : ""} ${visible ? "text-gray-800" : "invisible"}`}
    >
      <path d="M7.05 4.05a1 1 0 0 1 1.41 0l5.24 5.24a1 1 0 0 1 0 1.42l-5.24 5.24a1 1 0 1 1-1.41-1.42L11.59 10 7.05 5.46a1 1 0 0 1 0-1.41Z" />
    </svg>
  );
}

function Rama({ nodo, ruta, params, nivel }: { nodo: NodoCategoria; ruta: number[]; params: Record<string, string>; nivel: number }) {
  const elegida = ruta[ruta.length - 1] === nodo.id;
  const abierta = ruta.includes(nodo.id);
  // Cliquear la rama elegida la cierra y vuelve a su padre.
  const destino = elegida ? (ruta.length > 1 ? ruta[ruta.length - 2] : null) : nodo.id;
  return (
    <li>
      <Link
        href={hrefCategoria(params, destino)}
        scroll={false}
        style={{ paddingLeft: `${nivel * 14 + 4}px` }}
        className={`flex items-center gap-1.5 rounded py-1 pr-2 text-sm ${
          elegida ? "bg-gray-100 font-semibold text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        <Chevron abierta={abierta && nodo.hijas.length > 0} visible={nodo.hijas.length > 0} />
        <span className="min-w-0 flex-1 truncate">{nodo.nombre}</span>
        <span className="text-xs font-normal text-gray-400">{nodo.cantidad}</span>
      </Link>
      {abierta && nodo.hijas.length > 0 && (
        <ul>
          {nodo.hijas.map((h) => (
            <Rama key={h.id} nodo={h} ruta={ruta} params={params} nivel={nivel + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function PanelCategorias({ raices, ruta, params }: Props) {
  // En el celular el árbol arranca cerrado para no tapar los productos.
  const [abierto, setAbierto] = useState(false);
  if (raices.length === 0) return null;
  return (
    <aside className="lg:w-60 lg:shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 lg:hidden"
      >
        Categorías
        <Chevron abierta={abierto} visible />
      </button>
      <nav className={`${abierto ? "block" : "hidden"} mt-2 lg:mt-0 lg:block`}>
        <p className="mb-1 hidden text-xs font-semibold uppercase tracking-wide text-gray-400 lg:block">Categorías</p>
        <ul>
          <li>
            <Link
              href={hrefCategoria(params, null)}
              scroll={false}
              className={`flex items-center gap-1.5 rounded py-1 pl-1 pr-2 text-sm ${
                ruta.length === 0 ? "bg-gray-100 font-semibold text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Chevron abierta={false} visible={false} />
              Todos
            </Link>
          </li>
          {raices.map((r) => (
            <Rama key={r.id} nodo={r} ruta={ruta} params={params} nivel={0} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
