"use client";

import { useState } from "react";
import { Combobox } from "@/components/combobox";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

type Producto = {
  id: number;
  skuInterno: string;
  nombre: string;
  stockActual: number;
  precioCostoUnitario: string;
};

type Usuario = {
  id: number;
  nombre: string;
  apellido: string;
};

export function UsoInternoForm({
  productos,
  usuarios,
  fechaDefault,
}: {
  productos: Producto[];
  usuarios: Usuario[];
  fechaDefault: string;
}) {
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("1");

  const producto = productos.find((p) => String(p.id) === productoId);
  const costoUnitario = producto ? Number(producto.precioCostoUnitario) : 0;
  const montoEstimado = costoUnitario * (Number(cantidad) || 0);

  const opciones = productos.map((p) => ({
    value: String(p.id),
    label: `${p.skuInterno} · ${p.nombre}`,
    search: `${p.skuInterno} ${p.nombre}`,
    hint: `Stock: ${p.stockActual}`,
  }));

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Producto</label>
        <Combobox
          options={opciones}
          value={productoId}
          required
          placeholder="Buscar por nombre o SKU..."
          onSelect={setProductoId}
        />
        <input type="hidden" name="productoId" value={productoId} />
        {producto && (
          <p className="text-xs text-gray-400">
            Stock disponible: {producto.stockActual} · Costo unitario: {fmt(costoUnitario)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Cantidad</label>
          <input
            type="number"
            name="cantidad"
            min={1}
            required
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            name="fecha"
            defaultValue={fechaDefault}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Descripción</label>
        <textarea
          name="descripcion"
          rows={2}
          placeholder="Ej: contenido para redes de Instagram..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Pagado por</label>
        <select name="pagadoPorId" defaultValue="" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">Sin especificar</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} {u.apellido}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
        Gasto estimado (Marketing): <span className="font-semibold">{fmt(montoEstimado)}</span>
      </div>

      <button
        type="submit"
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Registrar uso interno
      </button>
    </div>
  );
}
