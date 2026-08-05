"use client";

import { useState } from "react";
import { editarItemConsignacion } from "../actions";

export function EditarItemForm({
  item,
}: {
  item: {
    id: number;
    cantidad: number;
    precioCosto: number;
    precioPiso: number;
  };
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-blue-600 underline underline-offset-2"
      >
        Editar
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await editarItemConsignacion(fd);
        setOpen(false);
      }}
      className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2"
    >
      <input type="hidden" name="id" value={item.id} />

      <div className="space-y-0.5">
        <label className="block text-xs text-yellow-700">Cantidad</label>
        <input
          name="cantidad"
          type="number"
          min={1}
          step={1}
          defaultValue={item.cantidad}
          required
          className="w-20 rounded-md border border-yellow-200 bg-white px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-0.5">
        <label className="block text-xs text-yellow-700">Costo real</label>
        <input
          name="costo"
          type="number"
          min={0}
          step={0.01}
          defaultValue={item.precioCosto}
          className="w-28 rounded-md border border-yellow-200 bg-white px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-0.5">
        <label className="block text-xs text-yellow-700">Precio piso</label>
        <input
          name="piso"
          type="number"
          min={0}
          step={0.01}
          defaultValue={item.precioPiso}
          className="w-28 rounded-md border border-yellow-200 bg-white px-2 py-1.5 text-sm"
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
