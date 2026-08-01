"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";

type HistorialItem = {
  id: number;
  sku: string;
  precioCostoScraped: number;
  precioConDescuento: number | null;
  proveedor: { nombre: string } | null;
};

type Producto = {
  id: number;
  skuInterno: string;
  nombre: string;
  marca: string;
  stockActual: number;
  precioCostoUnitario: number;
  precioVenta: number;
  historialStock: HistorialItem[];
};

const STOCK_BAJO_UMBRAL = 5;

export function ProductoRow({ p }: { p: Producto }) {
  const [expandido, setExpandido] = useState(false);
  const multiProveedor = p.historialStock.length > 1;
  const bajoStock = p.stockActual <= STOCK_BAJO_UMBRAL && p.stockActual > 0;
  const sinStock = p.stockActual === 0;

  return (
    <tr className={bajoStock ? "bg-red-50" : sinStock ? "bg-gray-50 opacity-60" : "hover:bg-gray-50"}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 font-mono text-xs text-gray-400">
          {multiProveedor && (
            <button
              onClick={() => setExpandido((v) => !v)}
              className="flex h-4 w-4 items-center justify-center rounded text-blue-500 hover:bg-blue-50 font-bold leading-none"
            >
              {expandido ? "−" : "+"}
            </button>
          )}
          <span className="w-20 truncate">{p.skuInterno}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="text-sm">{p.nombre}</div>
      </td>
      <td className="px-3 py-2">
        <div className="w-32 truncate text-sm text-gray-600">{p.marca}</div>
      </td>
      <td className="px-3 py-2">
        {p.historialStock.length === 0 && <span className="text-xs text-gray-300">—</span>}
        {expandido ? (
          p.historialStock.map((h) => (
            <div key={h.id} className="text-xs leading-5 text-blue-700 font-medium">{h.proveedor?.nombre}</div>
          ))
        ) : (
          <div className="text-xs text-gray-500">
            {p.historialStock.map((h) => h.proveedor?.nombre).join(", ")}
          </div>
        )}
      </td>
      <td className={`whitespace-nowrap px-3 py-2 text-right text-sm font-medium ${bajoStock ? "text-red-600" : sinStock ? "text-gray-400" : ""}`}>
        {p.stockActual}{bajoStock && " ⚠"}
      </td>
      <td className="px-3 py-2 text-right text-gray-500">
        {expandido ? (
          p.historialStock.map((h) => (
            <div key={h.id} className="text-xs leading-5">
              {formatCurrency((h.precioConDescuento ?? h.precioCostoScraped).toString())}
            </div>
          ))
        ) : (() => {
          if (p.historialStock.length === 0) return <span className="whitespace-nowrap text-sm">{formatCurrency(p.precioCostoUnitario.toString())}</span>;
          const precios = p.historialStock.map((h) => Number(h.precioConDescuento ?? h.precioCostoScraped));
          const min = Math.min(...precios);
          const max = Math.max(...precios);
          return min === max
            ? <span className="whitespace-nowrap text-sm">{formatCurrency(min.toString())}</span>
            : <span className="whitespace-nowrap text-sm">{formatCurrency(min.toString())} – {formatCurrency(max.toString())}</span>;
        })()}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
        {formatCurrency(p.precioVenta.toString())}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <Link
          href={`/inventario/productos/${p.id}/editar`}
          className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
        >
          Editar
        </Link>
      </td>
    </tr>
  );
}
