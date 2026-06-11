"use client";

import { useState } from "react";
import { NuevoProductoFields } from "./nuevo-producto-fields";

type Producto = {
  id: number;
  sku: string;
  nombre: string;
};

export function ProductoSelector({ productos }: { productos: Producto[] }) {
  const [esNuevo, setEsNuevo] = useState(false);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Producto</label>
      <select
        name="productoId"
        required
        defaultValue=""
        onChange={(e) => setEsNuevo(e.target.value === "nuevo")}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Seleccionar producto...
        </option>
        {productos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.sku} · {p.nombre}
          </option>
        ))}
        <option value="nuevo">+ Nuevo producto</option>
      </select>

      {esNuevo && <NuevoProductoFields />}
    </div>
  );
}
