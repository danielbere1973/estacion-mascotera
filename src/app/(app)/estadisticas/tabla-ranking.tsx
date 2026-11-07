"use client";

import { useMemo, useState, type ReactNode } from "react";

export type Columna<T> = {
  key: string;
  label: string;
  /** Valor usado para ordenar (y para mostrar si no hay `render`). */
  valor: (item: T) => string | number;
  render?: (item: T) => ReactNode;
  align?: "right";
  /** Oculta la columna en pantallas chicas. */
  ocultarMobile?: boolean;
  /** Contenido de la fila de totales para esta columna, calculado sobre las filas visibles. */
  total?: (items: T[]) => ReactNode;
  destacada?: boolean;
};

type Orden = { key: string; dir: "asc" | "desc" };

const PUESTO = "__puesto";

export function TablaRanking<T>({
  items,
  columnas,
  textoBusqueda,
  placeholder,
  vacio,
  sinCoincidencias,
  nombrePlural,
  criterio,
}: {
  items: T[];
  columnas: Columna<T>[];
  textoBusqueda: (item: T) => string;
  placeholder: string;
  vacio: string;
  sinCoincidencias: string;
  nombrePlural: string;
  /** Texto del orden por defecto, ej. "ordenado por unidades vendidas". */
  criterio: string;
}) {
  const [filtro, setFiltro] = useState("");
  const [orden, setOrden] = useState<Orden>({ key: PUESTO, dir: "asc" });

  // El puesto (#) es el del ranking original y no cambia al filtrar ni al reordenar.
  const conPuesto = useMemo(() => items.map((item, i) => ({ item, puesto: i + 1 })), [items]);

  const filas = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const filtradas = q ? conPuesto.filter(({ item }) => textoBusqueda(item).toLowerCase().includes(q)) : conPuesto;
    const col = columnas.find((c) => c.key === orden.key);
    const valorDe = (f: { item: T; puesto: number }) => (col ? col.valor(f.item) : f.puesto);
    const signo = orden.dir === "asc" ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      const va = valorDe(a);
      const vb = valorDe(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "es", { sensitivity: "base", numeric: true });
      return cmp * signo || a.puesto - b.puesto;
    });
  }, [conPuesto, filtro, textoBusqueda, columnas, orden]);

  const visibles = filas.map((f) => f.item);
  const filtrando = filtro.trim() !== "";
  const hayTotales = columnas.some((c) => c.total);
  // La etiqueta "Total" va en la primera columna sin total que se vea también en el celular.
  const idxEtiquetaTotal = columnas.findIndex((c) => !c.total && !c.ocultarMobile);

  function ordenarPor(key: string) {
    setOrden((o) => {
      if (o.key === key) return { key, dir: o.dir === "desc" ? "asc" : "desc" };
      // El # arranca por el primer puesto (el ranking); el resto, de mayor a menor.
      return { key, dir: key === PUESTO ? "asc" : "desc" };
    });
  }

  const encabezado = (key: string, label: string, align?: "right", ocultarMobile?: boolean, extra = "") => {
    const activa = orden.key === key;
    return (
      <th
        key={key}
        aria-sort={activa ? (orden.dir === "asc" ? "ascending" : "descending") : "none"}
        className={`px-3 py-2 ${align === "right" ? "text-right" : ""} ${ocultarMobile ? "hidden sm:table-cell" : ""} ${extra}`}
      >
        <button
          type="button"
          onClick={() => ordenarPor(key)}
          title="Ordenar"
          className={`inline-flex items-center gap-1 uppercase hover:text-gray-800 ${activa ? "text-gray-800" : ""} ${align === "right" ? "flex-row-reverse" : ""}`}
        >
          {label}
          <span className={`text-[10px] ${activa ? "" : "text-gray-300"}`}>
            {activa ? (orden.dir === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </th>
    );
  };

  const celdaClase = (c: Columna<T>) =>
    `px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.ocultarMobile ? "hidden sm:table-cell" : ""}`;

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-72"
      />
      <div className="max-h-[32rem] overflow-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              {encabezado(PUESTO, "#", undefined, false, "w-10")}
              {columnas.map((c) => encabezado(c.key, c.label, c.align, c.ocultarMobile))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={columnas.length + 1} className="px-3 py-6 text-center text-gray-400">
                  {items.length === 0 ? vacio : sinCoincidencias}
                </td>
              </tr>
            ) : (
              filas.map(({ item, puesto }) => (
                <tr key={puesto} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400 tabular-nums">{puesto}</td>
                  {columnas.map((c) => (
                    <td key={c.key} className={`${celdaClase(c)} ${c.destacada ? "font-medium" : ""}`}>
                      {c.render ? c.render(item) : c.valor(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {hayTotales && filas.length > 0 && (
            <tfoot className="sticky bottom-0 bg-gray-50 font-bold text-gray-900 shadow-[0_-1px_0_0_rgb(229,231,235)]">
              <tr>
                <td className="px-3 py-2" />
                {columnas.map((c, i) => (
                  <td key={c.key} className={celdaClase(c)}>
                    {c.total ? c.total(visibles) : i === idxEtiquetaTotal ? (filtrando ? "Total filtrado" : "Total") : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-gray-400">
        {filtrando ? `${filas.length} de ${items.length} ${nombrePlural}` : `${items.length} ${nombrePlural}`} · {criterio} · tocá un título para ordenar
      </p>
    </div>
  );
}
