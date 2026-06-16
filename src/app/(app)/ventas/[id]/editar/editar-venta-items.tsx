"use client";

import { useState } from "react";

type Detalle = {
  id: number;
  productoId: number;
  productoSku: string;
  productoNombre: string;
  cantidad: number;
  precioVentaUnitario: string;
  descuentoPorcentaje: string;
};

type Item = Detalle & { cantidadStr: string; descuentoMonto: string };

export function EditarVentaItems({ detalles }: { detalles: Detalle[] }) {
  const [items, setItems] = useState<Item[]>(
    detalles.map((d) => {
      const valorBruto = d.cantidad * Number(d.precioVentaUnitario);
      const pct = Number(d.descuentoPorcentaje) || 0;
      return {
        ...d,
        cantidadStr: String(d.cantidad),
        descuentoMonto: valorBruto > 0 ? (valorBruto * pct / 100).toFixed(2) : "0",
      };
    })
  );

  function update(id: number, changes: Partial<Item>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  function onCantidadChange(item: Item, value: string) {
    const cantidad = Number(value) || 0;
    const valorBruto = cantidad * (Number(item.precioVentaUnitario) || 0);
    const pct = Number(item.descuentoPorcentaje) || 0;
    const monto = valorBruto > 0 ? (valorBruto * pct / 100).toFixed(2) : "0";
    update(item.id, { cantidadStr: value, descuentoMonto: monto });
  }

  function onPrecioChange(item: Item, value: string) {
    const precio = Number(value) || 0;
    const cantidad = Number(item.cantidadStr) || 0;
    const valorBruto = precio * cantidad;
    const pct = Number(item.descuentoPorcentaje) || 0;
    const monto = valorBruto > 0 ? (valorBruto * pct / 100).toFixed(2) : "0";
    update(item.id, { precioVentaUnitario: value, descuentoMonto: monto });
  }

  function onDescuentoPctChange(item: Item, value: string) {
    const pct = Number(value) || 0;
    const valorBruto = (Number(item.precioVentaUnitario) || 0) * (Number(item.cantidadStr) || 0);
    const monto = valorBruto > 0 ? (valorBruto * pct / 100).toFixed(2) : "0";
    update(item.id, { descuentoPorcentaje: value, descuentoMonto: monto });
  }

  function onDescuentoMontoChange(item: Item, value: string) {
    const monto = Number(value) || 0;
    const valorBruto = (Number(item.precioVentaUnitario) || 0) * (Number(item.cantidadStr) || 0);
    const pct = valorBruto > 0 ? ((monto / valorBruto) * 100).toFixed(4) : "0";
    update(item.id, { descuentoMonto: value, descuentoPorcentaje: pct });
  }

  const totalBruto = items.reduce(
    (acc, item) => acc + (Number(item.cantidadStr) || 0) * (Number(item.precioVentaUnitario) || 0),
    0
  );

  const totalConDescuento = items.reduce((acc, item) => {
    const cantidad = Number(item.cantidadStr) || 0;
    const precio = Number(item.precioVentaUnitario) || 0;
    const descuento = Number(item.descuentoPorcentaje) || 0;
    return acc + cantidad * precio * (1 - descuento / 100);
  }, 0);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">Productos</label>

      <div className="hidden flex-wrap gap-2 sm:flex">
        <span className="min-w-[180px] flex-1 text-xs font-medium text-gray-500">Producto</span>
        <span className="w-16 text-xs font-medium text-gray-500">Cant.</span>
        <span className="w-28 text-xs font-medium text-gray-500">Precio unit.</span>
        <span className="w-20 text-xs font-medium text-gray-500">Desc. $</span>
        <span className="w-20 text-xs font-medium text-gray-500">Desc. %</span>
      </div>

      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="detalleId" value={item.id} />
          <span className="min-w-[180px] flex-1 text-sm text-gray-700">
            {item.productoSku} · {item.productoNombre}
          </span>

          <div className="space-y-0.5">
            <label className="block text-xs text-gray-400 sm:hidden">Cantidad</label>
            <input
              type="number"
              name="cantidad"
              min={1}
              required
              value={item.cantidadStr}
              onChange={(e) => onCantidadChange(item, e.target.value)}
              className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Cant."
            />
          </div>

          <div className="space-y-0.5">
            <label className="block text-xs text-gray-400 sm:hidden">Precio unitario</label>
            <input
              type="number"
              name="precioVentaUnitario"
              min={0}
              step="0.01"
              required
              value={item.precioVentaUnitario}
              onChange={(e) => onPrecioChange(item, e.target.value)}
              className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Precio"
            />
          </div>

          <div className="space-y-0.5">
            <label className="block text-xs text-gray-400 sm:hidden">Descuento $</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={item.descuentoMonto}
              onChange={(e) => onDescuentoMontoChange(item, e.target.value)}
              className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Dto. $"
              title="Descuento en pesos"
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
              value={item.descuentoPorcentaje}
              onChange={(e) => onDescuentoPctChange(item, e.target.value)}
              className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Dto. %"
              title="Descuento %"
            />
          </div>
        </div>
      ))}

      <div className="text-right text-sm">
        {totalConDescuento !== totalBruto && (
          <p className="text-gray-400 line-through">
            {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(totalBruto)}
          </p>
        )}
        <p className="font-semibold text-gray-700">
          Total a cobrar:{" "}
          {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(totalConDescuento)}
        </p>
      </div>
    </div>
  );
}
