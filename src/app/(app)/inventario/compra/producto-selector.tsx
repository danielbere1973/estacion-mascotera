"use client";

import { useState } from "react";
import { Combobox } from "@/components/combobox";
import { NuevoProductoFields } from "./nuevo-producto-fields";
import type { MayoristaItem } from "./mayorista-producto-selector";

type Producto = {
  id: number;
  sku: string;
  nombre: string;
};

const NUEVO = "nuevo";

export function ProductoSelector({
  productos,
  itemsDelProveedor = [],
}: {
  productos: Producto[];
  itemsDelProveedor?: MayoristaItem[];
}) {
  const [productoId, setProductoId] = useState("");

  const opciones = [
    { value: NUEVO, label: "+ Nuevo producto", search: "nuevo producto" },
    ...productos.map((p) => ({
      value: String(p.id),
      label: `${p.sku} · ${p.nombre}`,
      search: `${p.sku} ${p.nombre}`,
    })),
  ];

  const itemMayorista =
    productoId && productoId !== NUEVO
      ? itemsDelProveedor.find((i) => String(i.productoId) === productoId)
      : undefined;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Producto</label>
      <Combobox
        options={opciones}
        value={productoId}
        required
        placeholder="Buscar por nombre o SKU..."
        onSelect={setProductoId}
      />
      <input type="hidden" name="productoId" value={productoId} />

      {itemMayorista && (
        <p className="text-xs text-gray-500">
          SKU del proveedor: <span className="font-mono">{itemMayorista.sku}</span>
        </p>
      )}

      {productoId === NUEVO && <NuevoProductoFields />}
    </div>
  );
}
