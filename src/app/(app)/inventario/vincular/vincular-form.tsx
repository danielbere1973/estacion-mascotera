"use client";

import { useState } from "react";
import { vincularItem, crearYVincularProducto } from "./actions";

type Producto = { id: number; nombre: string; marca: string; sku: string };
type Item = {
  id: number;
  sku: string;
  nombre: string | null;
  tamanios: string | null;
  precioCostoScraped: string;
  productoId: number | null;
  productoNombre: string | null;
};

export function VincularForm({
  item,
  productos,
}: {
  item: Item;
  productos: Producto[];
}) {
  const [modo, setModo] = useState<"buscar" | "crear" | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);

  const productosFiltrados = productos.filter((p) => {
    const q = busqueda.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(q) ||
      p.marca.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  });

  if (item.productoId) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-green-700 font-medium">{item.productoNombre}</span>
        <form action={async (fd) => { fd.append("historialId", String(item.id)); await (await import("./actions")).desvincularItem(fd); }}>
          <button type="submit" className="text-xs text-gray-400 hover:text-red-500">
            Desvincular
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {modo === null && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModo("buscar")}
            className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Vincular a existente
          </button>
          <button
            type="button"
            onClick={() => setModo("crear")}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            Crear producto nuevo
          </button>
        </div>
      )}

      {modo === "buscar" && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Buscar por nombre, marca o SKU..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setProductoSeleccionado(null); }}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            autoFocus
          />
          {busqueda.length > 1 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
              {productosFiltrados.slice(0, 20).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProductoSeleccionado(p)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${productoSeleccionado?.id === p.id ? "bg-blue-50 font-medium" : ""}`}
                >
                  <span className="font-medium">{p.marca}</span> — {p.nombre}
                  <span className="ml-2 text-xs text-gray-400 font-mono">{p.sku}</span>
                </button>
              ))}
              {productosFiltrados.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">Sin resultados</div>
              )}
            </div>
          )}
          {productoSeleccionado && (
            <form action={vincularItem} className="flex items-center gap-2">
              <input type="hidden" name="historialId" value={item.id} />
              <input type="hidden" name="productoId" value={productoSeleccionado.id} />
              <span className="text-sm text-gray-700">
                → <span className="font-medium">{productoSeleccionado.marca} — {productoSeleccionado.nombre}</span>
              </span>
              <button type="submit" className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700">
                Confirmar
              </button>
              <button type="button" onClick={() => setProductoSeleccionado(null)} className="text-xs text-gray-400 hover:text-gray-600">
                Cancelar
              </button>
            </form>
          )}
          <button type="button" onClick={() => { setModo(null); setBusqueda(""); setProductoSeleccionado(null); }} className="text-xs text-gray-400 hover:text-gray-600">
            ← Volver
          </button>
        </div>
      )}

      {modo === "crear" && (
        <form action={crearYVincularProducto} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <input type="hidden" name="historialId" value={item.id} />
          <p className="text-xs font-medium text-gray-600">Nuevo producto</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1 col-span-2">
              <label className="text-xs text-gray-500">Nombre</label>
              <input name="nombre" defaultValue={item.nombre ?? ""} required className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Marca</label>
              <input name="marca" required className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Categoría</label>
              <input name="categoria" placeholder="Sin categorizar" className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Precio costo</label>
              <input name="precioCostoUnitario" type="number" step="0.01" defaultValue={item.precioCostoScraped} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Margen %</label>
              <input name="margenPorcentaje" type="number" defaultValue="30" className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700">
              Crear y vincular
            </button>
            <button type="button" onClick={() => setModo(null)} className="text-xs text-gray-400 hover:text-gray-600">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
