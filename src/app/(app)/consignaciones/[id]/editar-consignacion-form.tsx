"use client";

import { useState } from "react";
import { editarConsignacion } from "../actions";

interface Props {
  id: number;
  direccion: "ENTREGAMOS" | "RECIBIMOS";
  fecha: string; // ISO date string YYYY-MM-DD
  notas: string | null;
}

export function EditarConsignacionForm({ id, direccion, fecha, notas }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
      >
        Editar
      </button>
    );
  }

  return (
    <form
      action={async (fd) => { await editarConsignacion(fd); setOpen(false); }}
      className="flex gap-2 items-end flex-wrap rounded-xl border border-yellow-200 bg-yellow-50 p-3"
    >
      <input type="hidden" name="id" value={id} />

      <div>
        <label className="text-xs text-yellow-700">Dirección</label>
        <select
          name="direccion"
          defaultValue={direccion}
          className="block rounded-md border border-yellow-200 bg-white px-2 py-1.5 text-sm"
        >
          <option value="RECIBIMOS">Recibimos (el socio nos da mercadería)</option>
          <option value="ENTREGAMOS">Entregamos (nosotros damos mercadería al socio)</option>
        </select>
      </div>

      <div>
        <label className="text-xs text-yellow-700">Fecha</label>
        <input
          name="fecha"
          type="date"
          defaultValue={fecha}
          className="block rounded-md border border-yellow-200 bg-white px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex-1 min-w-[150px]">
        <label className="text-xs text-yellow-700">Notas</label>
        <input
          name="notas"
          defaultValue={notas ?? ""}
          placeholder="Notas opcionales..."
          className="block w-full rounded-md border border-yellow-200 bg-white px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-yellow-700"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
