"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AltaClienteModal } from "./alta-cliente-modal";

type Cliente = {
  id: number;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string | null;
  direccion: string;
  _count: { ventas: number };
};

export function ClientesLista({ clientes }: { clientes: Cliente[] }) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => `${c.nombre} ${c.apellido}`.toLowerCase().includes(q));
  }, [clientes, busqueda]);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Clientes</h1>
        <div className="flex items-center gap-2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre..."
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <AltaClienteModal />
          <Link
            href="/clientes/reposicion"
            className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Reposiciones pendientes
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Teléfono</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Dirección</th>
              <th className="px-3 py-2 text-right">Ventas</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">
                  {c.apellido}, {c.nombre}
                </td>
                <td className="px-3 py-2 text-gray-600">{c.telefono}</td>
                <td className="px-3 py-2 text-gray-600">{c.email ?? "-"}</td>
                <td className="px-3 py-2 text-gray-600">{c.direccion}</td>
                <td className="px-3 py-2 text-right text-gray-500">{c._count.ventas}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/clientes/${c.id}`}
                      className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Historial
                    </Link>
                    <Link
                      href={`/clientes/${c.id}/editar`}
                      className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      Editar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  {busqueda
                    ? "No se encontraron clientes para esa búsqueda."
                    : "No hay clientes cargados todavía."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
