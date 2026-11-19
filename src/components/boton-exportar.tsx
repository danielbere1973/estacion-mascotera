"use client";

import { useEffect, useRef, useState } from "react";

const FORMATOS = [
  { valor: "pdf", label: "PDF (.pdf)", icono: "📄" },
  { valor: "xls", label: "Excel (.xls)", icono: "📊" },
  { valor: "doc", label: "Word (.doc)", icono: "📝" },
] as const;

// Botón Exportar con las opciones PDF / Excel / Word. `ruta` es la API que genera el archivo
// (ej. /api/ventas/exportar) y `params` los filtros o búsquedas que tiene aplicados el listado.
export function BotonExportar({
  ruta,
  params,
  nota = "Con los filtros aplicados",
}: {
  ruta: string;
  params?: URLSearchParams | Record<string, string>;
  nota?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function url(formato: string) {
    const p = new URLSearchParams(params instanceof URLSearchParams ? params.toString() : params);
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    p.set("formato", formato);
    return `${ruta}?${p.toString()}`;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 md:w-auto"
      >
        ⬇️ Exportar
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[180px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {nota && <p className="px-3 py-1 text-xs text-gray-400">{nota}</p>}
          {FORMATOS.map((f) => (
            <a
              key={f.valor}
              href={url(f.valor)}
              download
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <span>{f.icono}</span>
              {f.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
