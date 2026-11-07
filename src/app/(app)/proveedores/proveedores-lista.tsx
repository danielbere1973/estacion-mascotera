"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ThOrdenable, useOrden, type ValorOrden } from "@/components/orden-tabla";

type Proveedor = {
  id: number;
  nombre: string;
  contacto: string | null; // teléfono
  email: string | null;
  cuit: string | null;
  alias: string | null;
  cbu: string | null;
  direccion: string | null;
  accountManager: string | null;
  horarios: string | null;
};

type Columna = "nombre" | "telefono" | "email" | "direccion";

function valorOrden(p: Proveedor, columna: Columna): ValorOrden {
  switch (columna) {
    case "nombre":
      return p.nombre;
    case "telefono":
      return p.contacto || null;
    case "email":
      return p.email || null;
    case "direccion":
      return p.direccion || null;
  }
}

// Mismo link de Waze que usa el bot de Telegram: abre la app y arranca a navegar.
const linkWaze = (direccion: string) =>
  `https://waze.com/ul?q=${encodeURIComponent(direccion)}&navigate=yes`;

export function ProveedoresLista({ proveedores }: { proveedores: Proveedor[] }) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return proveedores;
    return proveedores.filter((p) => `${p.nombre} ${p.direccion ?? ""}`.toLowerCase().includes(q));
  }, [proveedores, busqueda]);
  const { ordenadas, orden, ordenar } = useOrden(filtrados, valorOrden);

  const sinResultados = busqueda
    ? "No se encontraron proveedores para esa búsqueda."
    : "No hay proveedores cargados todavía.";

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-2">
          <h1 className="whitespace-nowrap text-xl font-semibold text-gray-900">Proveedores: {proveedores.length}</h1>
          <div className="md:hidden">
            <LinkAlta />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Fondo gris en mobile: en iPhone el borde del campo no siempre se ve. */}
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o dirección..."
            className="w-full rounded-md border border-gray-300 bg-gray-200 px-3 py-2 text-sm md:w-72 md:bg-white"
          />
          <div className="hidden md:block">
            <LinkAlta />
          </div>
        </div>
      </div>

      {/* Mobile: una tarjeta por proveedor. */}
      <ul className="space-y-2 md:hidden">
        {ordenadas.map((p) => (
          <li key={p.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <p className="font-semibold text-gray-900">{p.nombre}</p>
            <div className="mt-1 space-y-0.5 text-sm text-gray-600">
              {p.contacto && (
                <a href={`tel:${p.contacto}`} className="block text-blue-600">
                  📞 {p.contacto}
                </a>
              )}
              {p.email && (
                <a href={`mailto:${p.email}`} className="block truncate text-blue-600">
                  ✉️ {p.email}
                </a>
              )}
              {p.direccion && (
                <a
                  href={linkWaze(p.direccion)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-blue-600"
                >
                  📍 {p.direccion}
                </a>
              )}
              {p.accountManager && <p className="text-xs text-gray-500">Account Manager: {p.accountManager}</p>}
              {p.horarios && <p className="text-xs text-gray-500">Horarios: {p.horarios}</p>}
              {p.cuit && <p className="text-xs text-gray-500">CUIT/CUIL: <span className="font-mono">{p.cuit}</span></p>}
              {p.alias && <p className="text-xs text-gray-500">Alias: <span className="font-mono">{p.alias}</span></p>}
              {p.cbu && <p className="text-xs text-gray-500">CBU/CVU: <span className="font-mono">{p.cbu}</span></p>}
            </div>
            <div className="mt-2 flex gap-2">
              <Link
                href={`/inventario/proveedores/${p.id}`}
                className="flex-1 rounded-md bg-gray-100 py-2 text-center text-sm font-medium text-gray-700"
              >
                Productos
              </Link>
              <Link
                href={`/inventario/proveedores/${p.id}/editar?volver=/proveedores`}
                className="flex-1 rounded-md bg-blue-50 py-2 text-center text-sm font-medium text-blue-600"
              >
                Editar
              </Link>
            </div>
          </li>
        ))}
        {filtrados.length === 0 && <li className="py-6 text-center text-sm text-gray-400">{sinResultados}</li>}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <ThOrdenable label="Nombre" columna="nombre" orden={orden} onOrdenar={ordenar} />
              <ThOrdenable label="Teléfono" columna="telefono" orden={orden} onOrdenar={ordenar} />
              <ThOrdenable label="Email" columna="email" orden={orden} onOrdenar={ordenar} />
              <ThOrdenable label="Dirección" columna="direccion" orden={orden} onOrdenar={ordenar} />
              <th className="px-3 py-2">Horarios</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ordenadas.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{p.nombre}</td>
                <td className="px-3 py-2 text-gray-600">
                  {p.contacto ? (
                    <a href={`tel:${p.contacto}`} className="text-blue-600 hover:underline">
                      {p.contacto}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {p.email ? (
                    <a href={`mailto:${p.email}`} className="text-blue-600 hover:underline">
                      {p.email}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {p.direccion ? (
                    <a
                      href={linkWaze(p.direccion)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {p.direccion}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">{p.horarios ?? "-"}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/inventario/proveedores/${p.id}`}
                      className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Productos
                    </Link>
                    <Link
                      href={`/inventario/proveedores/${p.id}/editar?volver=/proveedores`}
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
                  {sinResultados}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// El alta de proveedores ya existe en Inventario → Proveedores.
function LinkAlta() {
  return (
    <Link
      href="/inventario/proveedores"
      className="whitespace-nowrap rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
    >
      + Nuevo
    </Link>
  );
}
