"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Combobox } from "@/components/combobox";
import { NuevoProductoFields } from "./nuevo-producto-fields";

export type MayoristaItem = {
  proveedorId: number;
  sku: string;
  nombre: string | null;
  precioCostoScraped: string;
  precioConDescuento: string | null;
  tamanios: string | null;
  productoId: number | null;
};

export function MayoristaProductoSelector({
  items,
  onPrecioChange,
}: {
  items: MayoristaItem[];
  onPrecioChange: (precio: string) => void;
}) {
  const [sku, setSku] = useState("");
  const item = items.find((i) => i.sku === sku);

  const opciones = items.map((i) => ({
    value: i.sku,
    label: `${i.nombre ?? ""}${i.tamanios ? ` · ${i.tamanios}` : ""} — ${formatCurrency(
      i.precioConDescuento ?? i.precioCostoScraped
    )}`,
    search: `${i.nombre ?? ""} ${i.sku} ${i.tamanios ?? ""}`,
  }));

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Producto (lista del proveedor)</label>
      <Combobox
        options={opciones}
        value={sku}
        required
        placeholder="Buscar por nombre o código..."
        onSelect={(nuevoSku) => {
          setSku(nuevoSku);
          const seleccionado = items.find((i) => i.sku === nuevoSku);
          if (seleccionado) {
            onPrecioChange(seleccionado.precioConDescuento ?? seleccionado.precioCostoScraped);
          }
        }}
      />

      {item &&
        (item.productoId ? (
          <>
            <input type="hidden" name="productoId" value={item.productoId} />
            <p className="text-xs text-gray-500">Vinculado a un producto existente de tu inventario.</p>
          </>
        ) : (
          <div key={item.sku} className="space-y-2">
            <input type="hidden" name="productoId" value="nuevo" />
            <p className="text-xs text-amber-600">
              Producto nuevo: completá el SKU propio y los datos faltantes.
            </p>
            <NuevoProductoFields defaultNombre={item.nombre ?? ""} />
          </div>
        ))}
    </div>
  );
}
