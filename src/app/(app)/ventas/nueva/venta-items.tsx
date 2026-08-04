"use client";

import { useState } from "react";
import { Combobox } from "@/components/combobox";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

type ItemConsignado = {
  detalleConsignacionId: number;
  consignacionId: number;
  socioNombre: string;
  disponible: number;
  precioPiso: string;
};

type Producto = {
  id: number;
  skuInterno: string;
  nombre: string;
  precioVenta: string;
  stockActual: number;
  proveedorIds: number[];
  consignados: ItemConsignado[];
};

type Proveedor = {
  id: number;
  nombre: string;
};

type Row = {
  key: number;
  productoId: string;
  cantidad: string;
  precio: string;
  descuento: string;
  descuentoMonto: string;
  detalleConsignacionId: string;
};

export function VentaItems({ productos, proveedores }: { productos: Producto[]; proveedores: Proveedor[] }) {
  const [rows, setRows] = useState<Row[]>([
    { key: 0, productoId: "", cantidad: "1", precio: "", descuento: "0", descuentoMonto: "0", detalleConsignacionId: "" },
  ]);
  const [nextKey, setNextKey] = useState(1);
  const [filtroProveedorId, setFiltroProveedorId] = useState("");
  const [costoEnvio, setCostoEnvio] = useState(0);

  function addRow() {
    setRows((r) => [
      ...r,
      { key: nextKey, productoId: "", cantidad: "1", precio: "", descuento: "0", descuentoMonto: "0", detalleConsignacionId: "" },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));
  }

  function updateRow(key: number, changes: Partial<Row>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  function onProductoChange(key: number, productoId: string) {
    const producto = productos.find((p) => String(p.id) === productoId);
    updateRow(key, {
      productoId,
      precio: producto ? producto.precioVenta : "",
      cantidad: "1",
      descuento: "0",
      descuentoMonto: "0",
      detalleConsignacionId: "",
    });
  }

  function onConsignacionChange(key: number, detalleConsignacionId: string, producto: Producto | undefined) {
    const consignado = producto?.consignados.find((c) => String(c.detalleConsignacionId) === detalleConsignacionId);
    updateRow(key, {
      detalleConsignacionId,
      precio: consignado ? consignado.precioPiso : (producto ? producto.precioVenta : ""),
      cantidad: "1",
    });
  }

  function onCantidadChange(key: number, value: string, row: Row, maxCantidad: number) {
    const cantidad = Number(value);
    const cantidadFinal = Number.isFinite(cantidad) && cantidad > maxCantidad ? maxCantidad : cantidad;
    updateRow(key, { cantidad: String(cantidadFinal) });
  }

  function onPrecioChange(key: number, value: string) {
    updateRow(key, { precio: value });
  }

  // Desc $ y Desc % son independientes — no se calculan mutuamente
  function onDescuentoMontoChange(key: number, value: string) {
    updateRow(key, { descuentoMonto: value });
  }

  function onDescuentoPctChange(key: number, value: string) {
    updateRow(key, { descuento: value });
  }

  const totalProductos = rows.reduce((acc, row) => {
    const cantidad = Number(row.cantidad) || 0;
    const precio = Number(row.precio) || 0;
    const descMonto = Number(row.descuentoMonto) || 0;
    const descPct = Number(row.descuento) || 0;
    const subtotal = cantidad * precio - descMonto - (cantidad * precio * descPct / 100);
    return acc + subtotal;
  }, 0);

  const totalACobrar = totalProductos + costoEnvio;

  const productosFiltrados = filtroProveedorId
    ? productos.filter((p) => p.proveedorIds.includes(Number(filtroProveedorId)))
    : productos;

  const opciones = productosFiltrados.map((p) => ({
    value: String(p.id),
    label: `${p.skuInterno} · ${p.nombre}`,
    search: `${p.skuInterno} ${p.nombre}`,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label className="text-sm font-medium text-gray-700">Productos</label>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Filtrar por proveedor</label>
          <select
            value={filtroProveedorId}
            onChange={(e) => setFiltroProveedorId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((prov) => (
              <option key={prov.id} value={prov.id}>{prov.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="hidden flex-wrap gap-2 sm:flex">
        <span className="min-w-[180px] flex-1 text-xs font-medium text-gray-500">Producto</span>
        <span className="w-16 text-xs font-medium text-gray-500">Cant.</span>
        <span className="w-28 text-xs font-medium text-gray-500">Precio unit.</span>
        <span className="w-20 text-xs font-medium text-gray-500">Desc. $</span>
        <span className="w-20 text-xs font-medium text-gray-500">Desc. %</span>
        <span className="w-24 text-xs font-medium text-gray-500 text-right">Subtotal</span>
        <span className="w-7"></span>
      </div>

      {rows.map((row) => {
        const producto = productos.find((p) => String(p.id) === row.productoId);
        const consignado = producto?.consignados.find((c) => String(c.detalleConsignacionId) === row.detalleConsignacionId);
        const maxCantidad = consignado ? Math.min(consignado.disponible, producto!.stockActual) : (producto?.stockActual ?? Infinity);
        const cantidad = Number(row.cantidad) || 0;
        const precio = Number(row.precio) || 0;
        const descMonto = Number(row.descuentoMonto) || 0;
        const descPct = Number(row.descuento) || 0;
        const subtotal = cantidad * precio - descMonto - (cantidad * precio * descPct / 100);

        return (
          <div key={row.key} className="flex flex-wrap items-center gap-2">
            <div className="min-w-[180px] flex-1">
              <Combobox
                options={opciones}
                value={row.productoId}
                required
                placeholder="Buscar por nombre o SKU..."
                onSelect={(productoId) => onProductoChange(row.key, productoId)}
              />
            </div>
            <input type="hidden" name="productoId" value={row.productoId} />
            <input type="hidden" name="detalleConsignacionId" value={row.detalleConsignacionId} />

            <div className="space-y-0.5">
              <label className="block text-xs text-gray-400 sm:hidden">Cantidad</label>
              <input
                type="number"
                name="cantidad"
                min={1}
                max={maxCantidad}
                required
                value={row.cantidad}
                onChange={(e) => onCantidadChange(row.key, e.target.value, row, maxCantidad)}
                className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Cant."
              />
            </div>

            <div className="space-y-0.5">
              <label className="block text-xs text-gray-400 sm:hidden">Precio unitario</label>
              <input
                type="number"
                name="precioVentaUnitario"
                min={0}
                step="0.01"
                required
                value={row.precio}
                onChange={(e) => onPrecioChange(row.key, e.target.value)}
                className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Precio"
              />
            </div>

            <div className="space-y-0.5">
              <label className="block text-xs text-gray-400 sm:hidden">Descuento $</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={row.descuentoMonto}
                onChange={(e) => onDescuentoMontoChange(row.key, e.target.value)}
                className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Dto. $"
                title="Descuento en pesos (independiente del %)"
              />
            </div>

            <div className="space-y-0.5">
              <label className="block text-xs text-gray-400 sm:hidden">Descuento %</label>
              <input
                type="number"
                name="descuentoPorcentaje"
                min={0}
                max={100}
                step="any"
                value={row.descuento}
                onChange={(e) => onDescuentoPctChange(row.key, e.target.value)}
                className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Dto. %"
                title="Descuento % (independiente del $)"
              />
            </div>

            <div className="w-24 text-right text-sm font-medium text-gray-700">
              <span className="block sm:hidden text-xs text-gray-400">Subtotal</span>
              {row.productoId ? fmt(subtotal) : "—"}
            </div>

            <button
              type="button"
              onClick={() => removeRow(row.key)}
              className="rounded-md px-2 py-1.5 text-sm text-red-500 hover:bg-red-50"
            >
              ✕
            </button>

            {producto && producto.consignados.length > 0 && (
              <div className="basis-full space-y-0.5">
                <label className="block text-xs text-gray-400">Origen</label>
                <select
                  value={row.detalleConsignacionId}
                  onChange={(e) => onConsignacionChange(row.key, e.target.value, producto)}
                  className="w-full max-w-md rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="">Stock propio</option>
                  {producto.consignados.map((c) => (
                    <option key={c.detalleConsignacionId} value={c.detalleConsignacionId}>
                      Consignación de {c.socioNombre} (#{c.consignacionId}) — disponible: {c.disponible}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {producto && (
              <span className="basis-full text-xs text-gray-400">
                {consignado
                  ? `Producto consignado por ${consignado.socioNombre} · disponible: ${consignado.disponible} · stock propio: ${producto.stockActual}`
                  : `Stock disponible: ${producto.stockActual}`}
              </span>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRow}
        className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
      >
        + Agregar producto
      </button>

      <div className="flex items-end justify-between gap-4 border-t border-gray-100 pt-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Costo de envío</label>
          <input
            type="number"
            name="costoEnvio"
            min={0}
            step="0.01"
            value={costoEnvio}
            onChange={(e) => setCostoEnvio(Number(e.target.value) || 0)}
            className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="text-right">
          {costoEnvio > 0 && (
            <p className="text-xs text-gray-500 mb-0.5">
              Productos: {fmt(totalProductos)} + Envío: {fmt(costoEnvio)}
            </p>
          )}
          <p className="text-base font-bold text-gray-900">
            Total a cobrar: {fmt(totalACobrar)}
          </p>
        </div>
      </div>
    </div>
  );
}
