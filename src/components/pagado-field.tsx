"use client";

import { useState } from "react";

type Usuario = { id: number; nombre: string; apellido: string };

export function PagadoField({
  usuarios,
  defaultPagado = false,
  defaultPagadoPorId = "",
}: {
  usuarios: Usuario[];
  defaultPagado?: boolean;
  defaultPagadoPorId?: string;
}) {
  const [pagado, setPagado] = useState(defaultPagado);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          name="pagado"
          className="h-4 w-4"
          checked={pagado}
          onChange={(e) => setPagado(e.target.checked)}
        />
        Pagado
      </label>
      <select
        name="pagadoPorId"
        defaultValue={defaultPagadoPorId}
        disabled={!pagado}
        className={`w-full rounded-md border px-3 py-2 text-sm transition-colors ${
          pagado
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
