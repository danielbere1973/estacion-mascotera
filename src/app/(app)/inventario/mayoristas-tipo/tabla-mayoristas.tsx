"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TipoMayoristaSelect } from "./tipo-mayorista-select";
import { actualizarTipoProductoMayoristaMasivo } from "./actions";

type Producto = {
  id: number;
  skuInterno: string;
  nombre: string;
  marca: string;
  categoria: string;
  tipoProductoMayorista: string | null;
};

const OPCIONES_MASIVO = [
  { value: "ALIMENTO_SECO", label: "Alimento seco" },
  { value: "ALIMENTO_HUMEDO", label: "Alimento húmedo" },
  { value: "SNACK", label: "Snack" },
  { value: "PIEDRAS", label: "Piedras" },
  { value: "ACCESORIOS", label: "Accesorios" },
  { value: "OTROS", label: "Otros" },
  { value: "", label: "— Quitar asignación —" },
];

// Solo lectura: sin selección masiva y el tipo se muestra como texto.
export function TablaMayoristas({ productos, soloLectura = false }: { productos: Producto[]; soloLectura?: boolean }) {
  const router = useRouter();
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [tipoMasivo, setTipoMasivo] = useState("ALIMENTO_SECO");
  const [isPending, startTransition] = useTransition();

  const todosSeleccionados = productos.length > 0 && seleccionados.size === productos.length;

  function toggleTodos() {
    setSeleccionados(todosSeleccionados ? new Set() : new Set(productos.map((p) => p.id)));
  }

  function toggleUno(id: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function aplicarMasivo() {
    if (seleccionados.size === 0) return;
    const formData = new FormData();
    seleccionados.forEach((id) => formData.append("productoIds", String(id)));
    formData.set("tipoProductoMayorista", tipoMasivo);
    startTransition(async () => {
      await actualizarTipoProductoMayoristaMasivo(formData);
      setSeleccionados(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {!soloLectura && seleccionados.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-sm font-medium text-blue-800">{seleccionados.size} seleccionados</span>
          <select
            value={tipoMasivo}
            onChange={(e) => setTipoMasivo(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {OPCIONES_MASIVO.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={aplicarMasivo}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Aplicando..." : "Aplicar a seleccionados"}
          </button>
          <button
            type="button"
            onClick={() => setSeleccionados(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Deseleccionar todos
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500">
              {!soloLectura && (
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" checked={todosSeleccionados} onChange={toggleTodos} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                </th>
              )}
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2 w-48">Tipo mayorista</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0">
                {!soloLectura && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(p.id)}
                      onChange={() => toggleUno(p.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                  </td>
                )}
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.skuInterno}</td>
                <td className="px-3 py-2">
                  <span className="block text-gray-800">{p.nombre}</span>
                  <span className="block text-xs text-gray-400">{p.marca}</span>
                </td>
                <td className="px-3 py-2 text-gray-600">{p.categoria}</td>
                <td className="px-3 py-2">
                  {soloLectura ? (
                    <span className="text-gray-700">
                      {OPCIONES_MASIVO.find((o) => o.value && o.value === p.tipoProductoMayorista)?.label ?? "Sin asignar"}
                    </span>
                  ) : (
                    <TipoMayoristaSelect productoId={p.id} value={p.tipoProductoMayorista ?? ""} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {productos.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-gray-400">No hay productos para este filtro.</p>
        )}
      </div>
    </div>
  );
}
