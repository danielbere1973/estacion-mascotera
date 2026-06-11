"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { ProveedorSelector } from "../proveedor-selector";
import { ProductoSelector } from "./producto-selector";
import { MayoristaProductoSelector, type MayoristaItem } from "./mayorista-producto-selector";

type Proveedor = { id: number; nombre: string };
type Producto = { id: number; sku: string; nombre: string };

export function CompraForm({
  proveedores,
  productos,
  mayoristaItems,
  action,
}: {
  proveedores: Proveedor[];
  productos: Producto[];
  mayoristaItems: MayoristaItem[];
  action: (formData: FormData) => void;
}) {
  const [proveedorId, setProveedorId] = useState("");
  const [modo, setModo] = useState<"mayorista" | "manual">("mayorista");
  const [precioCosto, setPrecioCosto] = useState("");
  const [descuento, setDescuento] = useState("0");

  const itemsDelProveedor = useMemo(
    () => mayoristaItems.filter((i) => String(i.proveedorId) === proveedorId),
    [proveedorId, mayoristaItems]
  );

  const hayListaProveedor = itemsDelProveedor.length > 0;
  const usarMayorista = modo === "mayorista" && hayListaProveedor;

  const costoFinal = (Number(precioCosto) || 0) * (1 - (Number(descuento) || 0) / 100);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <ProveedorSelector
        proveedores={proveedores}
        onChange={(value) => {
          setProveedorId(value);
          setModo("mayorista");
          setPrecioCosto("");
        }}
      />

      {proveedorId && proveedorId !== "nuevo" && hayListaProveedor && (
        <div className="flex gap-4 text-sm text-gray-700">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={modo === "mayorista"}
              onChange={() => setModo("mayorista")}
            />
            Lista del proveedor
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={modo === "manual"}
              onChange={() => setModo("manual")}
            />
            Carga manual
          </label>
        </div>
      )}

      {usarMayorista ? (
        <MayoristaProductoSelector items={itemsDelProveedor} onPrecioChange={setPrecioCosto} />
      ) : (
        <ProductoSelector productos={productos} />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Cantidad</label>
          <input
            type="number"
            name="cantidad"
            min={1}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Precio de costo unitario</label>
          <input
            type="number"
            name="precioCostoUnitario"
            min={0}
            step="0.01"
            required
            value={precioCosto}
            onChange={(e) => setPrecioCosto(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Descuento del proveedor (%)</label>
          <input
            type="number"
            name="descuentoPorcentaje"
            min={0}
            max={100}
            step="0.01"
            value={descuento}
            onChange={(e) => setDescuento(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Costo final unitario</label>
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
            {formatCurrency(costoFinal)}
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Costo de envío</label>
          <input
            type="number"
            name="costoEnvio"
            min={0}
            step="0.01"
            defaultValue={0}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">N° de pedido (opcional)</label>
          <input
            name="numeroPedido"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" name="facturado" className="h-4 w-4" />
            Facturado
          </label>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">N° de factura (opcional)</label>
          <input
            name="numeroFactura"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
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
