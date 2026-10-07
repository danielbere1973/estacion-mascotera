"use client";

import { useMemo, useState } from "react";

// Orden de tablas por columna: clic en el título ordena A→Z (▲), otro clic Z→A (▼).
// Sin columna elegida, las filas quedan en el orden en que llegan. Solo afecta la vista.

export type ValorOrden = string | number | null;

// null = sin dato, siempre al final. Textos sin distinguir mayúsculas ni acentos.
export function compararValores(a: ValorOrden, b: ValorOrden, asc: boolean) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const r =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "es", { sensitivity: "base", numeric: true });
  return asc ? r : -r;
}

export function useOrden<T, C extends string>(filas: T[], valor: (fila: T, columna: C) => ValorOrden) {
  const [orden, setOrden] = useState<{ columna: C; asc: boolean } | null>(null);
  const ordenar = (columna: C) =>
    setOrden((o) => (o?.columna === columna ? { columna, asc: !o.asc } : { columna, asc: true }));

  const ordenadas = useMemo(() => {
    if (!orden) return filas;
    return [...filas].sort((a, b) =>
      compararValores(valor(a, orden.columna), valor(b, orden.columna), orden.asc),
    );
  }, [filas, orden, valor]);

  return { ordenadas, orden, ordenar };
}

// Encabezado clickeable con los triángulos ▲▼ (tenues si la columna no está ordenada).
export function ThOrdenable<C extends string>({
  label,
  columna,
  orden,
  onOrdenar,
  className = "px-3 py-2",
}: {
  label: string;
  columna: C;
  orden: { columna: C; asc: boolean } | null;
  onOrdenar: (columna: C) => void;
  className?: string;
}) {
  const estado = orden?.columna === columna ? (orden.asc ? "asc" : "desc") : null;
  return (
    <th
      className={className}
      aria-sort={estado === "asc" ? "ascending" : estado === "desc" ? "descending" : undefined}
    >
      <button
        type="button"
        onClick={() => onOrdenar(columna)}
        title="Ordenar A→Z / Z→A"
        className="inline-flex items-center uppercase hover:text-gray-900"
      >
        {label}
        <span className="ml-1 inline-flex flex-col text-[8px] leading-[8px]" aria-hidden="true">
          <span className={estado === "asc" ? "text-gray-900" : "text-gray-300"}>▲</span>
          <span className={estado === "desc" ? "text-gray-900" : "text-gray-300"}>▼</span>
        </span>
      </button>
    </th>
  );
}
