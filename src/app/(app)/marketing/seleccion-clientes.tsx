"use client";

import { useMemo, useState } from "react";

type Cliente = {
  id: number;
  nombre: string;
  apellido: string;
  email: string | null;
};

export function SeleccionClientes({
  clientes,
  seleccionados,
  onCambiarSeleccionados,
}: {
  clientes: Cliente[];
  seleccionados: Set<number>;
  onCambiarSeleccionados: (seleccionados: Set<number>) => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => `${c.nombre} ${c.apellido}`.toLowerCase().includes(q));
  }, [clientes, busqueda]);

  const seleccionables = filtrados.filter((c) => c.email);
  const todosSeleccionados =
    seleccionables.length > 0 && seleccionables.every((c) => seleccionados.has(c.id));

  function alternarTodos() {
    const nuevo = new Set(seleccionados);
    if (todosSeleccionados) {
      seleccionables.forEach((c) => nuevo.delete(c.id));
    } else {
      seleccionables.forEach((c) => nuevo.add(c.id));
    }
    onCambiarSeleccionados(nuevo);
  }

  function alternarUno(id: number) {
    const nuevo = new Set(seleccionados);
    if (nuevo.has(id)) {
      nuevo.delete(id);
    } else {
      nuevo.add(id);
    }
    onCambiarSeleccionados(nuevo);
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:w-96 sm:flex-none">
      <p className="text-sm font-semibold text-gray-900">Destinatarios</p>
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre de cliente..."
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="h-[380px] overflow-y-auto rounded-md border border-gray-200">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
            <tr className="border-b border-gray-200">
              <th className="w-8 px-2 py-2">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={alternarTodos}
                  className="h-3.5 w-3.5"
                />
              </th>
              <th className="px-2 py-2 font-semibold">Cliente</th>
              <th className="px-2 py-2 font-semibold">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={3} className="px-2 py-4 text-center text-gray-400">
                  {busqueda
                    ? "No se encontraron clientes para esa búsqueda."
                    : "Todavía no hay clientes cargados."}
                </td>
              </tr>
            )}
            {filtrados.map((c) => (
              <tr key={c.id} className={`hover:bg-gray-50 ${!c.email ? "opacity-40" : ""}`}>
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={seleccionados.has(c.id)}
                    disabled={!c.email}
                    onChange={() => alternarUno(c.id)}
                    className="h-3.5 w-3.5"
                  />
                </td>
                <td className="break-words px-2 py-1.5 text-gray-800">
                  {c.nombre} {c.apellido}
                </td>
                <td className="break-words px-2 py-1.5 text-gray-500">{c.email || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
