"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ThOrdenable, useOrden, type ValorOrden } from "@/components/orden-tabla";
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

type Columna = "nombre" | "telefono" | "email" | "direccion" | "ventas";

function valorOrden(c: Cliente, columna: Columna): ValorOrden {
  switch (columna) {
    case "nombre":
      return `${c.apellido}, ${c.nombre}`;
    case "telefono":
      return c.telefono || null;
    case "email":
      return c.email || null;
    case "direccion":
      return c.direccion || null;
    case "ventas":
      return c._count.ventas;
  }
}

export function ClientesLista({ clientes }: { clientes: Cliente[] }) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => `${c.nombre} ${c.apellido}`.toLowerCase().includes(q));
  }, [clientes, busqueda]);
  const { ordenadas, orden, ordenar } = useOrden(filtrados, valorOrden);

  return (
    <>
      {/* En mobile: título y botones en una fila, buscador abajo a todo el ancho. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-2">
          <h1 className="whitespace-nowrap text-xl font-semibold text-gray-900">Clientes: {clientes.length}</h1>
          <div className="flex items-center gap-2 md:hidden">
            <AltaClienteModal />
            <LinkReposiciones />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Fondo gris en mobile: en iPhone el borde del campo no siempre se ve. */}
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full rounded-md border border-gray-300 bg-gray-200 px-3 py-2 text-sm md:w-auto md:bg-white"
          />
          <div className="hidden items-center gap-2 md:flex">
            <AltaClienteModal />
            <LinkReposiciones />
          </div>
        </div>
      </div>

      {/* Mobile: una tarjeta por cliente. */}
      <ul className="space-y-2 md:hidden">
        {ordenadas.map((c) => (
          <li key={c.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-gray-900">
                {c.apellido}, {c.nombre}
              </p>
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {c._count.ventas} {c._count.ventas === 1 ? "venta" : "ventas"}
              </span>
            </div>
            <div className="mt-1 space-y-0.5 text-sm text-gray-600">
              {c.telefono && (
                <a href={`tel:${c.telefono}`} className="block text-blue-600">
                  📞 {c.telefono}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="block truncate text-blue-600">
                  ✉️ {c.email}
                </a>
              )}
              {c.direccion && <p className="truncate">📍 {c.direccion}</p>}
            </div>
            <div className="mt-2 flex gap-2">
              <Link
                href={`/clientes/${c.id}`}
                className="flex-1 rounded-md bg-gray-100 py-2 text-center text-sm font-medium text-gray-700"
              >
                Historial
              </Link>
              <Link
                href={`/clientes/${c.id}/editar`}
                className="flex-1 rounded-md bg-blue-50 py-2 text-center text-sm font-medium text-blue-600"
              >
                Editar
              </Link>
            </div>
          </li>
        ))}
        {filtrados.length === 0 && (
          <li className="py-6 text-center text-sm text-gray-400">
            {busqueda ? "No se encontraron clientes para esa búsqueda." : "No hay clientes cargados todavía."}
          </li>
        )}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <ThOrdenable label="Nombre" columna="nombre" orden={orden} onOrdenar={ordenar} />
              <ThOrdenable label="Teléfono" columna="telefono" orden={orden} onOrdenar={ordenar} />
              <ThOrdenable label="Email" columna="email" orden={orden} onOrdenar={ordenar} />
              <ThOrdenable label="Dirección" columna="direccion" orden={orden} onOrdenar={ordenar} />
              <ThOrdenable
                label="Ventas"
                columna="ventas"
                orden={orden}
                onOrdenar={ordenar}
                className="px-3 py-2 text-right"
              />
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ordenadas.map((c) => (
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

function LinkReposiciones() {
  return (
    <Link
      href="/clientes/reposicion"
      className="whitespace-nowrap rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
    >
      <span className="md:hidden">Reposiciones</span>
      <span className="hidden md:inline">Reposiciones pendientes</span>
    </Link>
  );
}
