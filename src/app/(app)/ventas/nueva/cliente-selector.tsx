"use client";

import { useState } from "react";

type Cliente = {
  id: number;
  nombre: string;
  apellido: string;
};

export function ClienteSelector({ clientes }: { clientes: Cliente[] }) {
  const [esNuevo, setEsNuevo] = useState(false);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Cliente</label>
      <select
        name="clienteId"
        required
        defaultValue=""
        onChange={(e) => setEsNuevo(e.target.value === "nuevo")}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Seleccionar cliente...
        </option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre} {c.apellido}
          </option>
        ))}
        <option value="nuevo">+ Nuevo cliente</option>
      </select>

      {esNuevo && (
        <div className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
          <input
            name="clienteNombre"
            placeholder="Nombre"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="clienteApellido"
            placeholder="Apellido"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="clienteDireccion"
            placeholder="Dirección"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            name="clienteTelefono"
            placeholder="Teléfono"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="clienteEmail"
            placeholder="Email (opcional)"
            type="email"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  );
}
