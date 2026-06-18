"use client";

import { useMemo, useState } from "react";
import { ProveedorSelector } from "../proveedor-selector";
import { CompraItems } from "./compra-items";
import type { MayoristaItem } from "./mayorista-producto-selector";

type Proveedor = { id: number; nombre: string };
type Usuario = { id: number; nombre: string; apellido: string };

export function CompraForm({
  proveedores,
  productos: _productos,
  mayoristaItems,
  tiposProducto: _tiposProducto,
  usuarios,
  action,
}: {
  proveedores: Proveedor[];
  productos: { id: number; sku: string; nombre: string }[];
  mayoristaItems: MayoristaItem[];
  tiposProducto: { id: number; nombre: string }[];
  usuarios: Usuario[];
  action: (formData: FormData) => void;
}) {
  const [proveedorId, setProveedorId] = useState("");

  const itemsDelProveedor = useMemo(
    () => mayoristaItems.filter((i) => String(i.proveedorId) === proveedorId),
    [proveedorId, mayoristaItems]
  );

  return (
    <form action={action} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      {/* Cabecera */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <ProveedorSelector
            proveedores={proveedores}
            onChange={(value) => setProveedorId(value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Fecha de compra</label>
          <input
            type="date"
            name="fechaCompra"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Orden de pedido</label>
          <input
            name="numeroPedido"
            placeholder="Ej: OP-2024-001"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Pagado por</label>
          <select name="pagadoPorId" defaultValue="" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">— Sin especificar —</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.apellido}, {u.nombre}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Costo de envío total</label>
          <input
            type="number"
            name="costoEnvio"
            min={0}
            step="0.01"
            defaultValue={0}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2 justify-end">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" name="facturado" className="h-4 w-4" />
            Facturado
          </label>
          <input
            name="numeroFactura"
            placeholder="N° de factura (opcional)"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Items */}
      <div className="border-t border-gray-100 pt-4">
        <p className="mb-2 text-sm font-medium text-gray-700">Productos</p>
        {proveedorId && proveedorId !== "nuevo" ? (
          <CompraItems items={itemsDelProveedor} />
        ) : (
          <p className="text-sm text-gray-400">Seleccioná un proveedor para cargar productos.</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Guardar compra
      </button>
    </form>
  );
}
