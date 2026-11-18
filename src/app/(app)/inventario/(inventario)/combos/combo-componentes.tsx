"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Combobox } from "@/components/combobox";

export type ProductoOpcion = { id: number; nombre: string; skuInterno: string; precioCostoUnitario: string };

type Row = {
  id: number;
  productoId: number | null;
  cantidad: string;
};

const filaVacia = (): Row => ({ id: Date.now() + Math.random(), productoId: null, cantidad: "1" });

export function ComboComponentes({
  productos,
  iniciales = [],
}: {
  productos: ProductoOpcion[];
  iniciales?: { productoId: number; cantidad: number }[];
}) {
  const [rows, setRows] = useState<Row[]>(
    iniciales.length > 0
      ? iniciales.map((c) => ({ id: c.productoId, productoId: c.productoId, cantidad: String(c.cantidad) }))
      : [filaVacia()]
  );

  const opciones = productos.map((p) => ({
    value: String(p.id),
    label: `${p.nombre} — ${formatCurrency(p.precioCostoUnitario)}`,
    search: `${p.nombre} ${p.skuInterno}`,
  }));

  const productoPorId = new Map(productos.map((p) => [p.id, p]));

  function update(id: number, field: keyof Row, value: string | number | null) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function agregarFila() {
    setRows((prev) => [...prev, filaVacia()]);
  }

  function quitarFila(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  const costoTotal = rows.reduce((acc, r) => {
    const p = r.productoId ? productoPorId.get(r.productoId) : null;
    return acc + (p ? Number(p.precioCostoUnitario) * (Number(r.cantidad) || 0) : 0);
  }, 0);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Componentes del combo</label>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start gap-2 rounded-lg bg-gray-50 p-2">
            <div className="min-w-0 flex-1">
              <Combobox
                options={opciones}
                value={row.productoId ? String(row.productoId) : ""}
                placeholder="Buscar producto..."
                onSelect={(v) => update(row.id, "productoId", Number(v))}
              />
              <input type="hidden" name="componenteProductoId" value={row.productoId ?? ""} />
            </div>
            <input
              type="number"
              min={1}
              value={row.cantidad}
              onChange={(e) => update(row.id, "cantidad", e.target.value)}
              name="componenteCantidad"
              required
              className="w-20 shrink-0 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => quitarFila(row.id)}
              className="shrink-0 px-1 text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={agregarFila} className="text-sm text-blue-600 hover:underline">
        + Agregar componente
      </button>

      <p className="text-xs text-gray-500">
        Costo total de componentes: <span className="font-medium text-gray-700">{formatCurrency(costoTotal)}</span>
      </p>
    </div>
  );
}
