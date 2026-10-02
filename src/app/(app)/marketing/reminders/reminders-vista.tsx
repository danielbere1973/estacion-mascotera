"use client";

import { type ReactNode, useMemo, useState } from "react";
import { RemindersTabla, type FilaReminder } from "./reminders-tabla";

// Sin mayúsculas ni acentos, para que "ramon" encuentre "Ramón".
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Título, subtítulo, botones y tabla de Reminders, con el buscador por nombre de cliente o de mascota.
export function RemindersVista({
  titulo,
  subtitulo,
  acciones,
  filas,
  hoy,
}: {
  titulo: ReactNode;
  subtitulo: ReactNode;
  acciones: ReactNode;
  filas: FilaReminder[];
  hoy: string;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return filas;
    return filas.filter((f) => normalizar(`${f.cliente} ${f.mascota ?? ""}`).includes(q));
  }, [filas, busqueda]);

  return (
    <>
      <div>
        {titulo}
        <div className="mt-1 flex items-center justify-between gap-4">
          {subtitulo}
          <div className="flex items-start gap-2">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente o mascota..."
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            {acciones}
          </div>
        </div>
      </div>
      <RemindersTabla
        filas={filtradas}
        hoy={hoy}
        mensajeVacio={filas.length > 0 ? "No hay resultados para la búsqueda." : undefined}
      />
    </>
  );
}
