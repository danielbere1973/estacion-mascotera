"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Combobox } from "@/components/combobox";
import type { MayoristaItem } from "./mayorista-producto-selector";

type Row = {
  id: number;
  sku: string;
  nombre: string;
  precio: string;
  cantidad: string;
  descuento: string;
  modoManual: boolean;
  marca: string;
  categoria: string;
  presentacion: string;
  unidadMedida: string;
  contenido: string;
};

function costoFinal(precio: string, descuento: string) {
  const p = Number(precio) || 0;
  const d = Number(descuento) || 0;
  return p * (1 - d / 100);
}

const filaVacia = (): Row => ({
  id: Date.now(),
  sku: "",
  nombre: "",
  precio: "",
  cantidad: "1",
  descuento: "0",
  modoManual: false,
  marca: "",
  categoria: "",
  presentacion: "",
  unidadMedida: "",
  contenido: "1",
});

export function CompraItems({
  items,
  tiposProducto = [],
}: {
  items: MayoristaItem[];
  tiposProducto?: { id: number; nombre: string }[];
}) {
  const [rows, setRows] = useState<Row[]>([filaVacia()]);

  const opciones = items.map((i) => {
    const labelNombre = i.nombreCatalogo
      ? `${i.nombreCatalogo} (${i.nombre ?? i.sku})`
      : `${i.nombre ?? ""}${i.tamanios ? ` · ${i.tamanios}` : ""}`;
    return {
      value: i.sku,
      label: `${labelNombre} — ${formatCurrency(i.precioConDescuento ?? i.precioCostoScraped)}`,
      search: `${i.nombreCatalogo ?? ""} ${i.nombre ?? ""} ${i.sku} ${i.tamanios ?? ""}`,
    };
  });

  function update(id: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function seleccionarItem(id: number, sku: string) {
    const item = items.find((i) => i.sku === sku);
    if (!item) return;
    const precio = item.precioConDescuento ?? item.precioCostoScraped;
    const nombre = [item.nombre, item.tamanios].filter(Boolean).join(" · ");
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, sku, nombre, precio } : r))
    );
  }

  function agregarFila() {
    setRows((prev) => [...prev, filaVacia()]);
  }

  function toggleModoManual(id: number) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, modoManual: !r.modoManual, sku: "", nombre: "" } : r))
    );
  }

  function quitarFila(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="pb-1 pr-2 font-medium">Producto (lista proveedor)</th>
              <th className="pb-1 pr-2 font-medium w-20">Cant.</th>
              <th className="pb-1 pr-2 font-medium w-32">Precio lista</th>
              <th className="pb-1 pr-2 font-medium w-20">Dto %</th>
              <th className="pb-1 pr-2 font-medium w-32">Costo final</th>
              <th className="pb-1 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="py-1.5 pr-2">
                  {items.length > 0 && !row.modoManual ? (
                    <div className="space-y-1">
                      <Combobox
                        options={opciones}
                        value={row.sku}
                        placeholder="Buscar producto..."
                        onSelect={(sku) => seleccionarItem(row.id, sku)}
                      />
                      {row.sku && (
                        <p className="text-xs text-gray-400 font-mono">{row.sku}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleModoManual(row.id)}
                        className="text-xs text-gray-400 hover:text-blue-600"
                      >
                        No está en la lista → ingresar SKU manualmente
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <input
                        placeholder="SKU (ej: KFRCPINS...)"
                        value={row.sku}
                        onChange={(e) => update(row.id, "sku", e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-mono"
                      />
                      <input
                        placeholder="Nombre del producto"
                        value={row.nombre}
                        onChange={(e) => update(row.id, "nombre", e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                      {items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleModoManual(row.id)}
                          className="text-xs text-gray-400 hover:text-blue-600"
                        >
                          ← Volver a buscar en la lista
                        </button>
                      )}
                      <div className="grid grid-cols-2 gap-1 pt-1">
                        <input
                          placeholder="Marca"
                          value={row.marca}
                          onChange={(e) => update(row.id, "marca", e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        <select
                          value={row.categoria}
                          onChange={(e) => update(row.id, "categoria", e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">Categoría...</option>
                          {tiposProducto.map((t) => (
                            <option key={t.id} value={t.nombre}>{t.nombre}</option>
                          ))}
                        </select>
                        <select
                          value={row.presentacion}
                          onChange={(e) => update(row.id, "presentacion", e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">Presentación...</option>
                          <option value="BOLSA_CERRADA">Bolsa Cerrada</option>
                          <option value="CAJA_CERRADA">Caja Cerrada</option>
                          <option value="INDIVIDUAL">Individual</option>
                        </select>
                        <select
                          value={row.unidadMedida}
                          onChange={(e) => update(row.id, "unidadMedida", e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">Unidad...</option>
                          <option value="KILOGRAMOS">Kilogramos</option>
                          <option value="GRAMOS">Gramos</option>
                          <option value="LITROS">Litros</option>
                          <option value="MILILITROS">Mililitros</option>
                          <option value="UNIDAD">Unidad</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="Contenido"
                          value={row.contenido}
                          onChange={(e) => update(row.id, "contenido", e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  )}
                  {/* campos hidden para enviar al server */}
                  <input type="hidden" name="itemSku" value={row.sku} />
                  <input type="hidden" name="itemNombre" value={row.nombre} />
                  <input type="hidden" name="itemMarca" value={row.marca} />
                  <input type="hidden" name="itemCategoria" value={row.categoria} />
                  <input type="hidden" name="itemPresentacion" value={row.presentacion} />
                  <input type="hidden" name="itemUnidadMedida" value={row.unidadMedida} />
                  <input type="hidden" name="itemContenido" value={row.contenido} />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={1}
                    value={row.cantidad}
                    onChange={(e) => update(row.id, "cantidad", e.target.value)}
                    name="itemCantidad"
                    required
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.precio}
                    onChange={(e) => update(row.id, "precio", e.target.value)}
                    name="itemPrecio"
                    required
                    placeholder="0"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={row.descuento}
                    onChange={(e) => update(row.id, "descuento", e.target.value)}
                    name="itemDescuento"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="py-1.5 pr-2 tabular-nums text-gray-700 pt-2.5 text-sm">
                  {costoFinal(row.precio, row.descuento) > 0
                    ? formatCurrency(costoFinal(row.precio, row.descuento))
                    : "—"}
                </td>
                <td className="py-1.5">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarFila(row.id)}
                      className="text-red-400 hover:text-red-600 px-1"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={agregarFila}
        className="text-sm text-blue-600 hover:underline"
      >
        + Agregar producto
      </button>
    </div>
  );
}
