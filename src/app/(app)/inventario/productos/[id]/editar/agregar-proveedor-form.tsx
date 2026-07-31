"use client";

import { useState, useRef, useEffect } from "react";

type Item = {
  proveedorId: number;
  sku: string;
  nombre: string;
  precio: number;
};

type Proveedor = { id: number; nombre: string };

export function AgregarProveedorForm({
  productoId,
  proveedores,
  itemsPorProveedor,
  action,
}: {
  productoId: number;
  proveedores: Proveedor[];
  itemsPorProveedor: Item[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [proveedorId, setProveedorId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [skuSeleccionado, setSkuSeleccionado] = useState("");
  const [precio, setPrecio] = useState("");
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const itemsDelProveedor = itemsPorProveedor.filter(
    (i) => i.proveedorId === Number(proveedorId)
  );

  const tieneListaImportada = itemsDelProveedor.length > 0;

  const resultados = busqueda.length >= 1
    ? itemsDelProveedor.filter((i) =>
        i.sku.toLowerCase().includes(busqueda.toLowerCase()) ||
        i.nombre.toLowerCase().includes(busqueda.toLowerCase())
      ).slice(0, 20)
    : itemsDelProveedor.slice(0, 20);

  function seleccionarItem(item: Item) {
    setSkuSeleccionado(item.sku);
    setBusqueda(`${item.sku}${item.nombre ? ` — ${item.nombre}` : ""}`);
    setPrecio(item.precio.toString());
    setAbierto(false);
  }

  function handleProveedorChange(id: string) {
    setProveedorId(id);
    setSkuSeleccionado("");
    setBusqueda("");
    setPrecio("");
    setAbierto(false);
  }

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <form action={action} className="space-y-3 border-t border-gray-100 pt-3">
      <input type="hidden" name="productoId" value={productoId} />
      <input type="hidden" name="sku" value={skuSeleccionado} />
      <p className="text-xs font-medium text-gray-600">Agregar proveedor</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Proveedor</label>
          <select
            name="proveedorId"
            required
            value={proveedorId}
            onChange={(e) => handleProveedorChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Seleccionar...</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1" ref={ref}>
          <label className="text-xs text-gray-500">SKU del proveedor</label>
          {tieneListaImportada ? (
            <div className="relative">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setSkuSeleccionado("");
                  setPrecio("");
                  setAbierto(true);
                }}
                onFocus={() => setAbierto(true)}
                placeholder="Buscar por SKU o nombre..."
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-mono"
                autoComplete="off"
              />
              {abierto && resultados.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {resultados.map((i) => (
                    <button
                      key={i.sku}
                      type="button"
                      onMouseDown={() => seleccionarItem(i)}
                      className="flex w-full flex-col px-3 py-2 text-left hover:bg-blue-50"
                    >
                      <span className="font-mono text-xs text-blue-700">{i.sku}</span>
                      {i.nombre && <span className="text-xs text-gray-500 truncate">{i.nombre}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <input
              name="sku"
              placeholder={proveedorId ? "Sin lista — ingresá manual" : "Primero elegí proveedor"}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-mono"
            />
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500">Precio costo</label>
          <input
            name="precioCosto"
            type="number"
            step="0.01"
            min={0}
            required
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={tieneListaImportada && !skuSeleccionado}
        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Agregar proveedor
      </button>
    </form>
  );
}
