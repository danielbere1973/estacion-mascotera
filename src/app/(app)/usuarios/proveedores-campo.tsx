"use client";

import { useState } from "react";

// Restricción de acceso a Proveedores (alta y edición), independiente del rol.
// Va plegada en una fila con flecha, igual que las secciones: sin proveedores
// tildados el usuario ve todo; con alguno, solo ve datos de esos proveedores.
export function ProveedoresCampo({
  proveedores,
  seleccionados = [],
}: {
  proveedores: { id: number; nombre: string }[];
  seleccionados?: number[];
}) {
  const [marcados, setMarcados] = useState<Set<number>>(() => new Set(seleccionados));
  const [abierta, setAbierta] = useState(seleccionados.length > 0);

  const cambiar = (id: number, valor: boolean) =>
    setMarcados((prev) => {
      const nuevo = new Set(prev);
      if (valor) nuevo.add(id);
      else nuevo.delete(id);
      return nuevo;
    });

  const resumen =
    marcados.size === 0
      ? "Sin restricción"
      : `${marcados.size} ${marcados.size === 1 ? "proveedor" : "proveedores"}`;

  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="text-sm font-medium text-gray-700">Restricción de acceso a Proveedores</legend>

      <div className="rounded-lg border border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => setAbierta((a) => !a)}
          aria-expanded={abierta}
          className="flex w-full items-center gap-2 px-2 py-2 text-left"
        >
          <span className="rounded p-1 text-gray-500">
            <svg
              className={`h-4 w-4 transition-transform ${abierta ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
          <span className="flex-1 text-sm font-medium text-gray-700">🏭 Proveedores</span>
          <span className={`text-xs ${marcados.size ? "font-semibold text-amber-700" : "text-gray-500"}`}>
            {resumen}
          </span>
        </button>

        {/* Plegada solo se oculta: las casillas siguen en el formulario y se guardan igual. */}
        <div className={`${abierta ? "" : "hidden"} space-y-2 border-t border-gray-200 bg-white px-3 py-2 sm:pl-11`}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {proveedores.map((p) => (
              <label key={p.id} className="flex items-center gap-2 py-1.5 text-sm text-gray-700 sm:py-0.5">
                <input
                  type="checkbox"
                  name="proveedores"
                  value={p.id}
                  checked={marcados.has(p.id)}
                  onChange={(e) => cambiar(p.id, e.target.checked)}
                  className="h-5 w-5 shrink-0 sm:h-4 sm:w-4"
                />
                {p.nombre}
              </label>
            ))}
          </div>
          {marcados.size > 0 && (
            <button
              type="button"
              onClick={() => setMarcados(new Set())}
              className="text-xs text-blue-600 hover:underline"
            >
              Quitar restricción
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Sin proveedores tildados ve todo. Si tildás alguno, solo ve datos de esos proveedores y solo puede
        entrar a Dashboard, Ventas, Compras, Consignaciones y Logística.
      </p>
    </fieldset>
  );
}
