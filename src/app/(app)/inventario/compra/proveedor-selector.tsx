"use client";

import { useState } from "react";

type Proveedor = {
  id: number;
  nombre: string;
};

export function ProveedorSelector({ proveedores }: { proveedores: Proveedor[] }) {
  const [esNuevo, setEsNuevo] = useState(false);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Proveedor</label>
      <select
        name="proveedorId"
        required
        defaultValue=""
        onChange={(e) => setEsNuevo(e.target.value === "nuevo")}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Seleccionar proveedor...
        </option>
        {proveedores.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
        <option value="nuevo">+ Nuevo proveedor</option>
      </select>

      {esNuevo && (
        <div className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
          <input
            name="proveedorNombre"
            placeholder="Nombre"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            name="proveedorDireccion"
            placeholder="Dirección (opcional)"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="proveedorContacto"
            placeholder="Contacto (opcional)"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  );
}
