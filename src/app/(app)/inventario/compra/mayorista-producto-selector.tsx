"use client";

import { formatCurrency } from "@/lib/format";
import { Combobox } from "@/components/combobox";

export type MayoristaItem = {
  proveedorId: number;
  sku: string;
  nombre: string | null;
  precioCostoScraped: string;
  precioConDescuento: string | null;
  tamanios: string | null;
  productoId: number | null;
  productoSku: string | null;
};

export function MayoristaProductoSelector({
  items,
  onSelect,
}: {
  items: MayoristaItem[];
  onSelect: (precio: string, sku: string, nombre: string) => void;
}) {
  const opciones = items.map((i) => ({
    value: i.sku,
    label: `${i.nombre ?? ""}${i.tamanios ? ` · ${i.tamanios}` : ""} — ${formatCurrency(
      i.precioConDescuento ?? i.precioCostoScraped
    )}`,
    search: `${i.nombre ?? ""} ${i.sku} ${i.tamanios ?? ""}`,
  }));

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">Buscar en lista del proveedor</label>
      <Combobox
        options={opciones}
        value=""
        placeholder="Buscar por nombre o código..."
        onSelect={(sku) => {
          const item = items.find((i) => i.sku === sku);
          if (!item) return;
          const precio = item.precioConDescuento ?? item.precioCostoScraped;
          const nombre = [item.nombre, item.tamanios].filter(Boolean).join(" · ");
          onSelect(precio, item.sku, nombre);
        }}
      />
    </div>
  );
}
