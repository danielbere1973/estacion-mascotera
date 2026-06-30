"use client";

import { useState } from "react";
import { Combobox } from "@/components/combobox";

type ItemConsignado = {
  detalleConsignacionId: number;
  consignacionId: number;
  socioNombre: string;
  disponible: number;
  precioPiso: string;
};

type ProductoCatalogo = {
  id: number;
  sku: string;
  nombre: string;
  precioVenta: string;
  stockActual: number;
  consignados: ItemConsignado[];
};

type DetalleExistente = {
  id: number;
  productoId: number;
  productoSku: string;
  productoNombre: string;
  cantidad: number;
  precioVentaUnitario: string;
  descuentoPorcentaje: string;
};

type Row = {
  key: number;
  detalleId: string; // id del DetalleVenta existente, o "" si es un ítem nuevo
  productoId: string;
  productoLabel: string; // solo informativo, para ítems existentes
  cantidad: string;
  precio: string;
  descuento: string; // porcentaje
  descuentoMonto: string;
  detalleConsignacionId: string;
  stockBase: number; // stock disponible considerando lo ya reservado por este ítem
};

export function EditarVentaItems({
  detalles,
  productos,
}: {
  detalles: DetalleExistente[];
  productos: ProductoCatalogo[];
}) {
  const productosPorId = new Map(productos.map((p) => [p.id, p]));

  const [rows, setRows] = useState<Row[]>(
    detalles.map((d, i) => {
      const valorBruto = d.cantidad * Number(d.precioVentaUnitario);
      const pct = Number(d.descuentoPorcentaje) || 0;
      const producto = productosPorId.get(d.productoId);
      return {
        key: i,
        detalleId: String(d.id),
        productoId: String(d.productoId),
        productoLabel: `${d.productoSku} · ${d.productoNombre}`,
        cantidad: String(d.cantidad),
        precio: d.precioVentaUnitario,
        descuento: d.descuentoPorcentaje,
        descuentoMonto: valorBruto > 0 ? (valorBruto * pct / 100).toFixed(2) : "0",
        detalleConsignacionId: "",
        stockBase: (producto?.stockActual ?? 0) + d.cantidad,
      };
    })
  );
  const [nextKey, setNextKey] = useState(detalles.length);

  function addRow() {
    setRows((r) => [
      ...r,
      {
        key: nextKey,
        detalleId: "",
        productoId: "",
        productoLabel: "",
        cantidad: "1",
        precio: "",
        descuento: "0",
        descuentoMonto: "0",
        detalleConsignacionId: "",
        stockBase: 0,
      },
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
      stockBase: producto?.stockActual ?? 0,
    });
  }

  function onConsignacionChange(key: number, detalleConsignacionId: string, producto: ProductoCatalogo | undefined) {
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
    const valorBruto = cantidadFinal * (Number(row.precio) || 0);
    const pct = Number(row.descuento) || 0;
    const monto = valorBruto > 0 ? (valorBruto * pct / 100).toFixed(2) : "0";
    updateRow(key, { cantidad: String(cantidadFinal), descuentoMonto: monto });
  }

  function onPrecioChange(key: number, value: string, row: Row) {
    const precio = Number(value) || 0;
    const cantidad = Number(row.cantidad) || 0;
    const valorBruto = precio * cantidad;
    const pct = Number(row.descuento) || 0;
    const monto = valorBruto > 0 ? (valorBruto * pct / 100).toFixed(2) : "0";
    updateRow(key, { precio: value, descuentoMonto: monto });
  }

  function onDescuentoPctChange(key: number, value: string, row: Row) {
    const pct = Number(value) || 0;
    const valorBruto = (Number(row.precio) || 0) * (Number(row.cantidad) || 0);
    const monto = valorBruto > 0 ? (valorBruto * pct / 100).toFixed(2) : "0";
    updateRow(key, { descuento: value, descuentoMonto: monto });
  }

  function onDescuentoMontoChange(key: number, value: string, row: Row) {
    const monto = Number(value) || 0;
    const valorBruto = (Number(row.precio) || 0) * (Number(row.cantidad) || 0);
    const pct = valorBruto > 0 ? ((monto / valorBruto) * 100).toFixed(4) : "0";
    updateRow(key, { descuentoMonto: value, descuento: pct });
  }

  const totalBruto = rows.reduce((acc, row) => acc + (Number(row.cantidad) || 0) * (Number(row.precio) || 0), 0);

  const totalConDescuento = rows.reduce((acc, row) => {
    const cantidad = Number(row.cantidad) || 0;
    const precio = Number(row.precio) || 0;
    const descuento = Number(row.descuento) || 0;
    return acc + cantidad * precio * (1 - descuento / 100);
  }, 0);

  const opciones = productos.map((p) => ({
    value: String(p.id),
    label: `${p.sku} · ${p.nombre}`,
    search: `${p.sku} ${p.nombre}`,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">Productos</label>
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          + Agregar producto
        </button>
      </div>

      <div className="hidden flex-wrap gap-2 sm:flex">
        <span className="min-w-[180px] flex-1 text-xs font-medium text-gray-500">Producto</span>
        <span className="w-16 text-xs font-medium text-gray-500">Cant.</span>
        <span className="w-28 text-xs font-medium text-gray-500">Precio unit.</span>
        <span className="w-20 text-xs font-medium text-gray-500">Desc. $</span>
        <span className="w-20 text-xs font-medium text-gray-500">Desc. %</span>
        <span className="w-7"></span>
      </div>

      {rows.map((row) => {
        const esNuevo = !row.detalleId;
        const producto = productos.find((p) => String(p.id) === row.productoId);
        const consignado = producto?.consignados.find((c) => String(c.detalleConsignacionId) === row.detalleConsignacionId);
        const maxCantidad = esNuevo
          ? consignado
            ? Math.min(consignado.disponible, producto!.stockActual)
            : (producto?.stockActual ?? Infinity)
          : row.stockBase;

        return (
          <div key={row.key} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="detalleId" value={row.detalleId} />

            {esNuevo ? (
              <div className="min-w-[180px] flex-1">
                <Combobox
                  options={opciones}
                  value={row.productoId}
                  required
                  placeholder="Buscar por nombre o SKU..."
                  onSelect={(productoId) => onProductoChange(row.key, productoId)}
                />
              </div>
            ) : (
              <span className="min-w-[180px] flex-1 text-sm text-gray-700">{row.productoLabel}</span>
            )}
            <input type="hidden" name="productoId" value={row.productoId} />
            <input type="hidden" name="detalleConsignacionId" value={row.detalleConsignacionId} />

            <div className="space-y-0.5">
              <label className="block text-xs text-gray-400 sm:hidden">Cantidad</label>
              <input
                type="number"
                name="cantidad"
                min={1}
                max={Number.isFinite(maxCantidad) ? maxCantidad : undefined}
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
                onChange={(e) => onPrecioChange(row.key, e.target.value, row)}
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
                onChange={(e) => onDescuentoMontoChange(row.key, e.target.value, row)}
                className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Dto. $"
                title="Descuento en pesos"
              />
            </div>

            <div className="space-y-0.5">
              <label className="block text-xs text-gray-400 sm:hidden">Descuento %</label>
              <input
                type="number"
                name="descuentoPorcentaje"
                min={0}
                max={100}
                step="0.01"
                value={row.descuento}
                onChange={(e) => onDescuentoPctChange(row.key, e.target.value, row)}
                className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Dto. %"
                title="Descuento %"
              />
            </div>

            <button
              type="button"
              onClick={() => removeRow(row.key)}
              className="rounded-md px-2 py-1.5 text-sm text-red-500 hover:bg-red-50"
            >
              ✕
            </button>

            {esNuevo && producto && producto.consignados.length > 0 && (
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

            {esNuevo && producto && (
              <span className="basis-full text-xs text-gray-400">
                {consignado
                  ? `Producto consignado por ${consignado.socioNombre} · disponible: ${consignado.disponible} · stock propio: ${producto.stockActual}`
                  : `Stock disponible: ${producto.stockActual}`}
              </span>
            )}
            {!esNuevo && (
              <span className="basis-full text-xs text-gray-400">Stock disponible: {row.stockBase}</span>
            )}
          </div>
        );
      })}

      <div className="text-right text-sm">
        {totalConDescuento !== totalBruto && (
          <p className="text-gray-400 line-through">
            {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(totalBruto)}
          </p>
        )}
        <p className="font-semibold text-gray-700">
          Total a cobrar:{" "}
          {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(totalConDescuento)}
        </p>
      </div>
    </div>
  );
}
