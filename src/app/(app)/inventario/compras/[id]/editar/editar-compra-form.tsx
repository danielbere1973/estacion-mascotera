"use client";

import { useState } from "react";
import { Combobox } from "@/components/combobox";
import { actualizarCompra } from "../../../actions";

type Producto = { id: number; sku: string; nombre: string; marca: string };
type Proveedor = { id: number; nombre: string };

export function EditorCompraForm({
  compra,
  proveedores,
  productos,
}: {
  compra: {
    id: number;
    productoId: number;
    productoSku: string;
    productoNombre: string;
    proveedorId: number;
    cantidad: number;
    precioListaUnitario: number;
    descuentoPorcentaje: string;
    costoEnvio: string;
    numeroPedido: string | null;
    facturado: boolean;
    numeroFactura: string | null;
  };
  proveedores: Proveedor[];
  productos: Producto[];
}) {
  const [productoId, setProductoId] = useState(String(compra.productoId));

  const opciones = productos.map((p) => ({
    value: String(p.id),
    label: `${p.sku} · ${p.marca} ${p.nombre}`,
    search: `${p.sku} ${p.nombre} ${p.marca}`,
  }));

  return (
    <form action={actualizarCompra} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <input type="hidden" name="id" value={compra.id} />
      <input type="hidden" name="productoId" value={productoId} />

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Producto</label>
        <Combobox
          options={opciones}
          value={productoId}
          placeholder="Buscar por SKU o nombre..."
          onSelect={(v) => setProductoId(v)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Proveedor</label>
        <select name="proveedorId" required defaultValue={compra.proveedorId}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Cantidad</label>
          <input type="number" name="cantidad" min={1} required defaultValue={compra.cantidad}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Precio de costo (lista)</label>
          <input type="number" name="precioCostoUnitario" min={0} step="0.01" required
            defaultValue={compra.precioListaUnitario}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Descuento (%)</label>
          <input type="number" name="descuentoPorcentaje" min={0} max={100} step="0.01"
            defaultValue={compra.descuentoPorcentaje}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Costo de envío</label>
          <input type="number" name="costoEnvio" min={0} step="0.01"
            defaultValue={compra.costoEnvio}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">N° de pedido</label>
          <input name="numeroPedido" defaultValue={compra.numeroPedido ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input type="checkbox" name="facturado" defaultChecked={compra.facturado} className="h-4 w-4" />
            Facturado
          </label>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium text-gray-700">N° de factura</label>
          <input name="numeroFactura" defaultValue={compra.numeroFactura ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <button type="submit"
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        Guardar cambios
      </button>
    </form>
  );
}
