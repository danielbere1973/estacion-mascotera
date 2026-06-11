"use client";

import { useState } from "react";
import { Combobox } from "@/components/combobox";

type Producto = {
  id: number;
  sku: string;
  nombre: string;
  precioVenta: string;
  stockActual: number;
};

type Row = {
  key: number;
  productoId: string;
  cantidad: string;
  precio: string;
  descuento: string;
};

export function VentaItems({ productos }: { productos: Producto[] }) {
  const [rows, setRows] = useState<Row[]>([
    { key: 0, productoId: "", cantidad: "1", precio: "", descuento: "0" },
  ]);
  const [nextKey, setNextKey] = useState(1);

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
    });
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

  const opciones = productos.map((p) => ({
    value: String(p.id),
    label: `${p.sku} · ${p.nombre}`,
    search: `${p.sku} ${p.nombre}`,
  }));

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">Productos</label>

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

            <input
              type="number"
              name="cantidad"
              min={1}
              required
              value={row.cantidad}
              onChange={(e) => updateRow(row.key, { cantidad: e.target.value })}
              className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Cant."
            />

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
