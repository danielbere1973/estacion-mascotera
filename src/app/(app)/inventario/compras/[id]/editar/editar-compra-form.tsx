"use client";

import { useMemo, useState } from "react";
import { Combobox } from "@/components/combobox";
import { formatCurrency } from "@/lib/format";
import { actualizarCompra } from "../../../actions";

type MayoristaItem = {
  proveedorId: number;
  sku: string;
  nombre: string | null;
  tamanios: string | null;
  precioCostoScraped: string;
  precioConDescuento: string | null;
  productoId: number | null;
};

type Proveedor = { id: number; nombre: string };

export function EditorCompraForm({
  compra,
  proveedores,
  mayoristaItems,
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
  mayoristaItems: MayoristaItem[];
}) {
  const [proveedorId, setProveedorId] = useState(String(compra.proveedorId));
  const [skuSeleccionado, setSkuSeleccionado] = useState("");
  const [precio, setPrecio] = useState(String(compra.precioListaUnitario));
  const [labelSeleccionado, setLabelSeleccionado] = useState("");

  const itemsFiltrados = useMemo(
    () => mayoristaItems.filter((i) => String(i.proveedorId) === proveedorId),
    [proveedorId, mayoristaItems]
  );

  const opciones = itemsFiltrados.map((i) => ({
    value: i.sku,
    label: `${i.nombre ?? i.sku}${i.tamanios ? ` · ${i.tamanios}` : ""} — ${formatCurrency(i.precioConDescuento ?? i.precioCostoScraped)}${!i.productoId ? " ⚠ sin vincular" : ""}`,
    search: `${i.nombre ?? ""} ${i.sku} ${i.tamanios ?? ""}`,
  }));

  function seleccionarProducto(sku: string) {
    const item = itemsFiltrados.find((i) => i.sku === sku);
    if (!item) return;
    if (!item.productoId) {
      alert(`"${item.nombre ?? sku}" no está vinculado al catálogo. Vinculalo primero desde Lista de Precios → columna "Vincular".`);
      setSkuSeleccionado("");
      setLabelSeleccionado("");
      return;
    }
    setSkuSeleccionado(sku);
    setPrecio(item.precioConDescuento ?? item.precioCostoScraped);
    setLabelSeleccionado(`${item.nombre ?? sku}${item.tamanios ? ` · ${item.tamanios}` : ""}`);
  }

  return (
    <form action={actualizarCompra} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <input type="hidden" name="id" value={compra.id} />
      <input type="hidden" name="itemSku" value={skuSeleccionado} />

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Proveedor</label>
        <select name="proveedorId" required value={proveedorId}
          onChange={(e) => { setProveedorId(e.target.value); setSkuSeleccionado(""); setLabelSeleccionado(""); }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Producto</label>
        <p className="text-xs text-gray-500 mb-1">
          Actual: <span className="font-medium">{compra.productoSku} · {compra.productoNombre}</span>
          {!skuSeleccionado && <span className="text-gray-400"> — buscá abajo para cambiar</span>}
        </p>
        {itemsFiltrados.length > 0 ? (
          <>
            <Combobox
              options={opciones}
              value={skuSeleccionado}
              placeholder="Buscar por nombre, SKU o tamaño..."
              onSelect={seleccionarProducto}
            />
            {labelSeleccionado && (
              <p className="text-xs text-green-700 mt-1">Nuevo: <span className="font-medium">{labelSeleccionado}</span></p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            No hay lista de precios cargada para este proveedor.
          </p>
        )}
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
            value={precio} onChange={(e) => setPrecio(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Descuento del proveedor (%)</label>
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
          <label className="text-sm font-medium text-gray-700">N° de pedido (opcional)</label>
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
          <label className="text-sm font-medium text-gray-700">N° de factura (opcional)</label>
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
