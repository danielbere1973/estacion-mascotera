"use client";

import { useState } from "react";

type Usuario = { id: number; nombre: string; apellido: string };

export function CobradoField({
  usuarios,
  defaultCobrado = false,
  defaultCobradoPorId = "",
}: {
  usuarios: Usuario[];
  defaultCobrado?: boolean;
  defaultCobradoPorId?: string;
}) {
  const [cobrado, setCobrado] = useState(defaultCobrado);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          name="cobrado"
          className="h-4 w-4"
          checked={cobrado}
          onChange={(e) => setCobrado(e.target.checked)}
        />
        Cobrado
      </label>
      <select
        name="cobradoPorId"
        defaultValue={defaultCobradoPorId}
        disabled={!cobrado}
        className={`w-full rounded-md border px-3 py-2 text-sm transition-colors ${
          cobrado
            ? "border-gray-300 bg-white text-gray-900"
            : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
        }`}
      >
        <option value="">— Sin especificar —</option>
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.apellido}, {u.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
