"use client";

import { useState } from "react";

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

      {esNuevo && (
        <div className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
          <input
            name="productoSku"
            placeholder="SKU / Código de barra"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="productoNombre"
            placeholder="Nombre"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="productoMarca"
            placeholder="Marca"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            name="productoCategoria"
            required
            defaultValue=""
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Categoría...
            </option>
            <option value="ALIMENTO">Alimento</option>
            <option value="POUCH">Pouch</option>
            <option value="LATA">Lata</option>
            <option value="SNACK">Snack</option>
            <option value="GOLOSINA">Golosina</option>
          </select>
          <select
            name="productoPresentacion"
            required
            defaultValue=""
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Presentación...
            </option>
            <option value="BOLSA_CERRADA">Bolsa Cerrada</option>
            <option value="CAJA_CERRADA">Caja Cerrada</option>
            <option value="INDIVIDUAL">Individual</option>
          </select>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Margen sobre costo (%)</label>
            <input
              name="productoMargen"
              type="number"
              step="0.01"
              defaultValue={30}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
