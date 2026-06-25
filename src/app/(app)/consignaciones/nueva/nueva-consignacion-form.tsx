"use client";

import { useState } from "react";
import { crearConsignacion } from "../actions";

type Socio = { id: number; nombre: string };
type Producto = { id: number; nombre: string; marca: string; stockActual: number };

export function NuevaConsignacionForm({ socios, productos }: { socios: Socio[]; productos: Producto[] }) {
  const today = new Date().toISOString().split("T")[0];
  const [direccion, setDireccion] = useState<"ENTREGAMOS" | "RECIBIMOS">("ENTREGAMOS");
  const [items, setItems] = useState([{ productoId: "", descripcion: "", cantidad: 1, costo: 0, piso: 0 }]);

  const addItem = () => setItems([...items, { productoId: "", descripcion: "", cantidad: 1, costo: 0, piso: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, j) => j !== i));
  const updateItem = (i: number, field: string, value: string | number) =>
    setItems(items.map((it, j) => (j === i ? { ...it, [field]: value } : it)));

  return (
    <form action={crearConsignacion} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Socio *</label>
          <select name="socioId" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Seleccionar...</option>
            {socios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Fecha</label>
          <input name="fecha" type="date" defaultValue={today} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Dirección *</label>
        <div className="flex gap-4">
          {(["ENTREGAMOS", "RECIBIMOS"] as const).map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="direccion" value={d} checked={direccion === d} onChange={() => setDireccion(d)} />
              {d === "ENTREGAMOS" ? "Nosotros entregamos mercadería al socio" : "El socio nos entrega mercadería a nosotros"}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {direccion === "ENTREGAMOS"
            ? "El socio la vende por nosotros. Al registrar ventas, el socio nos paga el precio piso."
            : "Nosotros la vendemos por el socio. Al registrar ventas, le pagamos el precio piso al socio."}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Productos</label>
          <button type="button" onClick={addItem}
            className="rounded-md border border-blue-300 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">
            + Agregar ítem
          </button>
        </div>

        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end rounded-lg bg-gray-50 p-3">
            <div className="col-span-4 space-y-1">
              <label className="text-xs text-gray-500">Producto del catálogo</label>
              <select
                name="itemProductoId"
                value={item.productoId}
                onChange={(e) => updateItem(i, "productoId", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              >
                <option value="">— Sin vincular —</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} ({p.marca}) — stock: {p.stockActual}</option>
                ))}
              </select>
            </div>
            <div className="col-span-3 space-y-1">
              <label className="text-xs text-gray-500">Descripción libre</label>
              <input
                name="itemDescripcion"
                value={item.descripcion}
                onChange={(e) => updateItem(i, "descripcion", e.target.value)}
                placeholder="Si no está en el catálogo"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              />
            </div>
            <div className="col-span-1 space-y-1">
              <label className="text-xs text-gray-500">Cant.</label>
              <input
                name="itemCantidad"
                type="number"
                min={1}
                value={item.cantidad}
                onChange={(e) => updateItem(i, "cantidad", Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-gray-500">Costo real</label>
              <input
                name="itemCosto"
                type="number"
                min={0}
                value={item.costo}
                onChange={(e) => updateItem(i, "costo", Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-gray-500">Precio piso</label>
              <input
                name="itemPiso"
                type="number"
                min={0}
                value={item.piso}
                onChange={(e) => updateItem(i, "piso", Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              />
            </div>
            {items.length > 1 && (
              <button type="button" onClick={() => removeItem(i)}
                className="col-span-12 text-right text-xs text-red-400 hover:text-red-600">
                Quitar
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Notas</label>
        <textarea name="notas" rows={2} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>

      <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        Registrar consignación
      </button>
    </form>
  );
}
