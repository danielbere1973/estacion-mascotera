"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/format";

type Compra = {
  id: number;
  fechaCompra: Date;
  cantidad: number;
  precioCostoUnitario: string;
  descuentoPorcentaje: string;
  costoEnvio: string | null;
  numeroPedido: string | null;
  facturado: boolean;
  numeroFactura: string | null;
  proveedor: { nombre: string };
  producto: { sku: string; nombre: string };
};

type Grupo = {
  clave: string;
  proveedor: string;
  fecha: Date;
  numeroPedido: string | null;
  facturado: boolean;
  numeroFactura: string | null;
  costoEnvio: number;
  items: Compra[];
  totalItems: number;
  totalCosto: number;
};

function agrupar(compras: Compra[]): Grupo[] {
  const mapa = new Map<string, Grupo>();

  for (const c of compras) {
    // Agrupar por numeroPedido si existe, sino por proveedor+fecha
    const clave = c.numeroPedido
      ? `pedido-${c.numeroPedido}-${c.proveedor.nombre}`
      : `single-${c.id}`;

    if (!mapa.has(clave)) {
      mapa.set(clave, {
        clave,
        proveedor: c.proveedor.nombre,
        fecha: c.fechaCompra,
        numeroPedido: c.numeroPedido,
        facturado: c.facturado,
        numeroFactura: c.numeroFactura,
        costoEnvio: Number(c.costoEnvio ?? 0),
        items: [],
        totalItems: 0,
        totalCosto: 0,
      });
    }

    const grupo = mapa.get(clave)!;
    grupo.items.push(c);
    grupo.totalItems += c.cantidad;
    grupo.totalCosto += c.cantidad * Number(c.precioCostoUnitario) * (1 - Number(c.descuentoPorcentaje) / 100);
  }

  return Array.from(mapa.values());
}

export function ComprasAgrupadas({
  compras,
  esRestringido,
  accionEliminar,
}: {
  compras: Compra[];
  esRestringido: boolean;
  accionEliminar: (formData: FormData) => void;
}) {
  const grupos = agrupar(compras);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  function toggle(clave: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      next.has(clave) ? next.delete(clave) : next.add(clave);
      return next;
    });
  }

  if (grupos.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-gray-400">
        No hay compras registradas.
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {grupos.map((g) => {
        const abierto = abiertos.has(g.clave);
        const esMultiple = g.items.length > 1;

        return (
          <div key={g.clave}>
            {/* Fila cabecera del grupo */}
            <div
              className={`flex items-center gap-3 px-4 py-3 ${esMultiple ? "cursor-pointer hover:bg-gray-50" : "hover:bg-gray-50"}`}
              onClick={() => esMultiple && toggle(g.clave)}
            >
              {/* Flecha solo si tiene varios productos */}
              <span className="w-4 text-gray-400 text-xs">
                {esMultiple ? (abierto ? "▼" : "▶") : "·"}
              </span>

              <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {formatDate(g.fecha)}
                </span>
                <span className="font-medium text-sm">{g.proveedor}</span>
                <span className="text-xs text-gray-500">
                  {g.numeroPedido ? (
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                      {g.numeroPedido}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </span>
                <span className="text-xs text-gray-500">
                  {esMultiple
                    ? `${g.items.length} productos · ${g.totalItems} unid.`
                    : `${g.items[0].producto.sku} · ${g.items[0].producto.nombre}`}
                </span>
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(g.totalCosto)}
                    {g.costoEnvio > 0 && (
                      <span className="text-xs text-gray-400 ml-1">
                        +env {formatCurrency(g.costoEnvio)}
                      </span>
                    )}
                  </span>
                  {g.facturado ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 whitespace-nowrap">
                      F {g.numeroFactura ?? ""}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
                      S/F
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Detalle de productos (expandible) */}
            {(abierto || !esMultiple) && esMultiple && (
              <div className="bg-gray-50 border-t border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase">
                      <th className="pl-10 pr-3 py-1.5 text-left font-medium">SKU</th>
                      <th className="px-3 py-1.5 text-left font-medium">Producto</th>
                      <th className="px-3 py-1.5 text-right font-medium">Cant.</th>
                      <th className="px-3 py-1.5 text-right font-medium">Precio</th>
                      <th className="px-3 py-1.5 text-right font-medium">Dto</th>
                      <th className="px-3 py-1.5 text-right font-medium">Total</th>
                      {!esRestringido && <th className="px-3 py-1.5"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {g.items.map((item) => (
                      <tr key={item.id} className="hover:bg-white">
                        <td className="pl-10 pr-3 py-1.5 font-mono text-gray-500">{item.producto.sku}</td>
                        <td className="px-3 py-1.5">{item.producto.nombre}</td>
                        <td className="px-3 py-1.5 text-right">{item.cantidad}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(item.precioCostoUnitario)}</td>
                        <td className="px-3 py-1.5 text-right">
                          {Number(item.descuentoPorcentaje) > 0 ? `${item.descuentoPorcentaje}%` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                          {formatCurrency(item.cantidad * Number(item.precioCostoUnitario) * (1 - Number(item.descuentoPorcentaje) / 100))}
                        </td>
                        {!esRestringido && (
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">
                            <Link href={`/inventario/compras/${item.id}/editar`}
                              className="text-blue-500 hover:text-blue-700 text-xs mr-2">
                              Editar
                            </Link>
                            <form action={accionEliminar} className="inline">
                              <input type="hidden" name="id" value={item.id} />
                              <button
                                type="submit"
                                className="text-red-400 hover:text-red-600 text-xs"
                                onClick={(e) => {
                                  if (!confirm("¿Eliminar este ítem? Se revertirá el stock.")) e.preventDefault();
                                }}
                              >
                                Eliminar
                              </button>
                            </form>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Si es un solo item, mostrar acciones inline */}
            {!esMultiple && !esRestringido && (
              <div className="flex items-center gap-3 px-4 pb-2 pl-11">
                <Link href={`/inventario/compras/${g.items[0].id}/editar`}
                  className="text-xs text-blue-500 hover:text-blue-700">
                  Editar
                </Link>
                <form action={accionEliminar} className="inline">
                  <input type="hidden" name="id" value={g.items[0].id} />
                  <button type="submit" className="text-xs text-red-400 hover:text-red-600"
                    onClick={(e) => { if (!confirm("¿Eliminar esta compra? Se revertirá el stock.")) e.preventDefault(); }}>
                    Eliminar
                  </button>
                </form>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
