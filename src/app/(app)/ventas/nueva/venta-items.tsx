"use client";

import { useState } from "react";
import { Combobox } from "@/components/combobox";

type Producto = {
  id: number;
  sku: string;
  nombre: string;
  precioVenta: string;
  stockActual: number;
  proveedorIds: number[];
};

type Proveedor = {
  id: number;
  nombre: string;
};

type Row = {
  key: number;
  productoId: string;
  cantidad: string;
  precio: string;
  descuento: string;
};

export function VentaItems({ productos, proveedores }: { productos: Producto[]; proveedores: Proveedor[] }) {
  const [rows, setRows] = useState<Row[]>([
    { key: 0, productoId: "", cantidad: "1", precio: "", descuento: "0" },
  ]);
  const [nextKey, setNextKey] = useState(1);
  const [filtroProveedorId, setFiltroProveedorId] = useState("");

  function addRow() {
    setRows((r) => [
      ...r,
      { key: nextKey, productoId: "", cantidad: "1", precio: "", descuento: "0" },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));
  }

  function updateRow(key: number, changes: Partial<Row>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  function onProductoChange(key: number, productoId: string) {
    const producto = productos.find((p) => String(p.id) === productoId);
    updateRow(key, {
      productoId,
      precio: producto ? producto.precioVenta : "",
      cantidad: "1",
    });
  }

  function onCantidadChange(key: number, value: string, stockActual: number) {
    const cantidad = Number(value);
    if (Number.isFinite(cantidad) && cantidad > stockActual) {
      updateRow(key, { cantidad: String(stockActual) });
      return;
    }
    updateRow(key, { cantidad: value });
  }

  const totalBruto = rows.reduce((acc, row) => {
    const cantidad = Number(row.cantidad) || 0;
    const precio = Number(row.precio) || 0;
    return acc + cantidad * precio;
  }, 0);

  const totalConDescuento = rows.reduce((acc, row) => {
    const cantidad = Number(row.cantidad) || 0;
    const precio = Number(row.precio) || 0;
    const descuento = Number(row.descuento) || 0;
    const precioFinal = precio * (1 - descuento / 100);
    return acc + cantidad * precioFinal;
  }, 0);

  const productosFiltrados = filtroProveedorId
    ? productos.filter((p) => p.proveedorIds.includes(Number(filtroProveedorId)))
    : productos;

  const opciones = productosFiltrados.map((p) => ({
    value: String(p.id),
    label: `${p.sku} · ${p.nombre}`,
    search: `${p.sku} ${p.nombre}`,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label className="text-sm font-medium text-gray-700">Productos</label>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Filtrar por proveedor</label>
          <select
            value={filtroProveedorId}
            onChange={(e) => setFiltroProveedorId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((prov) => (
              <option key={prov.id} value={prov.id}>
                {prov.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="hidden flex-wrap gap-2 sm:flex">
        <span className="min-w-[180px] flex-1 text-xs font-medium text-gray-500">Producto</span>
        <span className="w-20 text-xs font-medium text-gray-500">Cantidad</span>
        <span className="w-28 text-xs font-medium text-gray-500">Precio</span>
        <span className="w-20 text-xs font-medium text-gray-500">Descuento %</span>
        <span className="w-7"></span>
      </div>

      {rows.map((row) => {
        const producto = productos.find((p) => String(p.id) === row.productoId);
        return (
          <div key={row.key} className="flex flex-wrap items-center gap-2">
            <div className="min-w-[180px] flex-1">
              <Combobox
                options={opciones}
                value={row.productoId}
                required
                placeholder="Buscar por nombre o SKU..."
                onSelect={(productoId) => onProductoChange(row.key, productoId)}
              />
            </div>
            <input type="hidden" name="productoId" value={row.productoId} />

            <div className="space-y-0.5">
              <label className="block text-xs text-gray-400 sm:hidden">Cantidad</label>
              <input
                type="number"
                name="cantidad"
                min={1}
                max={producto?.stockActual}
                required
                value={row.cantidad}
                onChange={(e) => onCantidadChange(row.key, e.target.value, producto?.stockActual ?? Infinity)}
                className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Cant."
              />
            </div>

            <div className="space-y-0.5">
              <label className="block text-xs text-gray-400 sm:hidden">Precio</label>
              <input
                type="number"
                name="precioVentaUnitario"
                min={0}
                step="0.01"
                required
                value={row.precio}
                onChange={(e) => updateRow(row.key, { precio: e.target.value })}
                className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Precio"
              />
            </div>

            <div className="space-y-0.5">
              <label className="block text-xs text-gray-400 sm:hidden">Descuento %</label>
              <input
                type="number"
                name="descuentoPorcentaje"
                min={0}
                max={100}
                step="0.01"
                value={row.descuento}
                onChange={(e) => updateRow(row.key, { descuento: e.target.value })}
                className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Desc. %"
                title="Descuento %"
              />
            </div>

            <button
              type="button"
              onClick={() => removeRow(row.key)}
              className="rounded-md px-2 py-1.5 text-sm text-red-500 hover:bg-red-50"
            >
              ✕
            </button>

            {producto && (
              <span className="basis-full text-xs text-gray-400">
                Stock disponible: {producto.stockActual}
              </span>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRow}
        className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
      >
        + Agregar producto
      </button>

      <div className="text-right text-sm">
        {totalConDescuento !== totalBruto && (
          <p className="text-gray-400 line-through">
            {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(totalBruto)}
          </p>
        )}
        <p className="font-semibold text-gray-700">
          Total a cobrar: {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(totalConDescuento)}
        </p>
      </div>
    </div>
  );
}
