"use client";

import { useRef, useState, useTransition } from "react";
import { calcularPreviewHym } from "./actions";
import { TablaCambiosHym } from "./tabla-cambios-hym";
import type { ResultadoCalculoHym } from "@/lib/hym-precios";

export function SubirArchivosHym() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<ResultadoCalculoHym | null>(null);
  const [error, setError] = useState<string | null>(null);

  function calcular() {
    setError(null);
    setResultado(null);
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);

    startTransition(async () => {
      try {
        const res = await calcularPreviewHym(formData);
        setResultado(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al calcular los cambios.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form
        ref={formRef}
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          calcular();
        }}
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">productos.csv</label>
          <input
            type="file"
            name="csv"
            accept=".csv"
            required
            className="block text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Productos-Cambios_HyM.xlsx</label>
          <input
            type="file"
            name="hymExcel"
            accept=".xlsx"
            required
            className="block text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Calculando..." : "Calcular cambios"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {resultado && <TablaCambiosHym resultado={resultado} />}
    </div>
  );
}
