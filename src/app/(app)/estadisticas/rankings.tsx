"use client";

import { useMemo, useState } from "react";
import { formatARS } from "@/lib/reporte-utils";

export type ClienteRanking = { nombre: string; compras: number; unidades: number; total: number };
export type GastoCategoria = { categoria: string; cantidad: number; total: number };

// Devuelve las filas con su puesto en el ranking completo (no cambia al filtrar), filtradas por texto.
function useFiltroRanking<T>(items: T[], texto: (item: T) => string) {
  const [filtro, setFiltro] = useState("");
  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const conPuesto = items.map((item, i) => ({ item, puesto: i + 1 }));
    return q ? conPuesto.filter(({ item }) => texto(item).toLowerCase().includes(q)) : conPuesto;
  }, [items, filtro, texto]);
  return { filtro, setFiltro, filtrados, filtrando: filtro.trim() !== "" };
}

function Buscador({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-72"
    />
  );
}

const textoCliente = (c: ClienteRanking) => c.nombre;
const textoGasto = (g: GastoCategoria) => g.categoria;

export function ClientesMasCompras({ clientes }: { clientes: ClienteRanking[] }) {
  const { filtro, setFiltro, filtrados, filtrando } = useFiltroRanking(clientes, textoCliente);

  return (
    <div className="space-y-2">
      <Buscador value={filtro} onChange={setFiltro} placeholder="Buscar cliente…" />
      <div className="max-h-[32rem] overflow-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2 text-right">Compras</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">Unidades</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  {clientes.length === 0 ? "Sin ventas en el período" : "Ningún cliente coincide con la búsqueda"}
                </td>
              </tr>
            ) : (
              filtrados.map(({ item: c, puesto }) => (
                <tr key={puesto} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400 tabular-nums">{puesto}</td>
                  <td className="px-3 py-2">{c.nombre}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.compras}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{c.unidades}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatARS(c.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">
        {filtrando ? `${filtrados.length} de ${clientes.length} clientes` : `${clientes.length} clientes`} · ordenado por total comprado
      </p>
    </div>
  );
}

export function GastosPorCategoria({ categorias }: { categorias: GastoCategoria[] }) {
  const { filtro, setFiltro, filtrados, filtrando } = useFiltroRanking(categorias, textoGasto);
  const totalGeneral = categorias.reduce((a, c) => a + c.total, 0);
  const totalVisible = filtrados.reduce((a, { item }) => a + item.total, 0);
  const cantidadVisible = filtrados.reduce((a, { item }) => a + item.cantidad, 0);

  return (
    <div className="space-y-2">
      <Buscador value={filtro} onChange={setFiltro} placeholder="Buscar categoría…" />
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2 text-right">Gastos</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">% del total</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  {categorias.length === 0 ? "Sin gastos en el período" : "Ninguna categoría coincide con la búsqueda"}
                </td>
              </tr>
            ) : (
              filtrados.map(({ item: c, puesto }) => (
                <tr key={c.categoria} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400 tabular-nums">{puesto}</td>
                  <td className="px-3 py-2">{c.categoria}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.cantidad}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                    {totalGeneral > 0 ? `${((c.total / totalGeneral) * 100).toFixed(1)}%` : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatARS(c.total)}</td>
                </tr>
              ))
            )}
          </tbody>
          {filtrados.length > 0 && (
            <tfoot className="bg-gray-50 text-sm font-semibold text-gray-800">
              <tr>
                <td colSpan={2} className="px-3 py-2">{filtrando ? "Total filtrado" : "Total"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{cantidadVisible}</td>
                <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                  {filtrando && totalGeneral > 0 ? `${((totalVisible / totalGeneral) * 100).toFixed(1)}%` : ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatARS(totalVisible)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
