"use client";

import { useState } from "react";
import { agregarItemConsignacion } from "../actions";

type Producto = { id: number; nombre: string; marca: string; stockActual: number };

export function AgregarItemForm({
  consignacionId,
  direccion,
  productos,
}: {
  consignacionId: number;
  direccion: "ENTREGAMOS" | "RECIBIMOS";
  productos: Producto[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500"
      >
        + Agregar ítem a esta consignación
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await agregarItemConsignacion(fd);
        setOpen(false);
      }}
      className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3"
    >
      <input type="hidden" name="consignacionId" value={consignacionId} />
      <p className="text-sm font-medium text-blue-800">Agregar ítem</p>

      <div className="space-y-1">
        <label className="text-xs text-gray-500">Producto del catálogo</label>
        <select
          name="productoId"
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">— Sin vincular (no afecta stock) —</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.marca}) — stock: {p.stockActual}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-500">Descripción (opcional)</label>
        <input
          name="descripcion"
          placeholder="ej: Litera de madera grande"
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Cantidad</label>
          <input
            name="cantidad"
            type="number"
            min={1}
            step={1}
            defaultValue={1}
            required
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Costo real</label>
          <input
            name="costo"
            type="number"
            min={0}
            step={0.01}
            defaultValue={0}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Precio piso</label>
          <input
            name="piso"
            type="number"
            min={0}
            step={0.01}
            defaultValue={0}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <p className="text-xs text-gray-400">
        {direccion === "ENTREGAMOS"
          ? "Al agregar: baja el stock disponible y sube el stock en consignación."
          : "Al agregar: sube el stock disponible."}
      </p>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Agregar
        </button>
      </div>
    </form>
  );
}
