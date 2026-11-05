"use client";

import { useMemo, useState } from "react";
import { formatARS } from "@/lib/reporte-utils";

export type ProductoRanking = { sku: string; nombre: string; unidades: number; total: number; ventas: number };

export function ProductosMasVendidos({ productos }: { productos: ProductoRanking[] }) {
  const [filtro, setFiltro] = useState("");

  // El puesto (#) es el del ranking completo, así no cambia al filtrar.
  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const conPuesto = productos.map((p, i) => ({ ...p, puesto: i + 1 }));
    if (!q) return conPuesto;
    return conPuesto.filter((p) => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [productos, filtro]);

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar por nombre o SKU…"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-72"
      />
      <div className="max-h-[32rem] overflow-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 w-10">#</th>
              <th className="hidden px-3 py-2 sm:table-cell">SKU</th>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2 text-right">Unidades</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  {productos.length === 0 ? "Sin ventas en el período" : "Ningún producto coincide con la búsqueda"}
                </td>
              </tr>
            ) : (
              filtrados.map((p) => (
                <tr key={`${p.sku}-${p.puesto}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400 tabular-nums">{p.puesto}</td>
                  <td className="hidden px-3 py-2 text-gray-500 sm:table-cell">{p.sku}</td>
                  <td className="px-3 py-2">
                    {p.nombre}
                    <span className="block text-xs text-gray-400 sm:hidden">{p.sku}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{p.unidades}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatARS(p.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">
        {filtro.trim() ? `${filtrados.length} de ${productos.length} productos` : `${productos.length} productos`} · ordenado por unidades vendidas
      </p>
    </div>
  );
}
