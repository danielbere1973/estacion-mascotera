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

export function EditarVentaItems({ detalles }: { detalles: Detalle[] }) {
  const [items, setItems] = useState(
    detalles.map((d) => ({
      ...d,
      cantidad: String(d.cantidad),
    }))
  );

  function update(id: number, changes: Partial<(typeof items)[number]>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  const totalBruto = items.reduce(
    (acc, item) => acc + (Number(item.cantidad) || 0) * (Number(item.precioVentaUnitario) || 0),
    0
  );

  const totalConDescuento = items.reduce((acc, item) => {
    const cantidad = Number(item.cantidad) || 0;
    const precio = Number(item.precioVentaUnitario) || 0;
    const descuento = Number(item.descuentoPorcentaje) || 0;
    return acc + cantidad * precio * (1 - descuento / 100);
  }, 0);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">Productos</label>

      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="detalleId" value={item.id} />
          <span className="min-w-[180px] flex-1 text-sm text-gray-700">
            {item.productoSku} · {item.productoNombre}
          </span>

          <input
            type="number"
            name="cantidad"
            min={1}
            required
            value={item.cantidad}
            onChange={(e) => update(item.id, { cantidad: e.target.value })}
            className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Cant."
          />

          <input
            type="number"
            name="precioVentaUnitario"
            min={0}
            step="0.01"
            required
            value={item.precioVentaUnitario}
            onChange={(e) => update(item.id, { precioVentaUnitario: e.target.value })}
            className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Precio"
          />

          <input
            type="number"
            name="descuentoPorcentaje"
            min={0}
            max={100}
            step="0.01"
            value={item.descuentoPorcentaje}
            onChange={(e) => update(item.id, { descuentoPorcentaje: e.target.value })}
            className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Desc. %"
            title="Descuento %"
          />
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
