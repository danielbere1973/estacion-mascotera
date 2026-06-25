"use client";

import { useState } from "react";
import { actualizarVentaConsignacion } from "../actions";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

interface Props {
  venta: {
    id: number;
    fecha: Date;
    cantidad: number;
    precioVentaReal: number;
    precioCosto: number;
    liquidacionId: number | null;
    facturado: boolean;
    numeroFactura: string | null;
    maxCantidad: number;
  };
}

export function VentaRow({ venta }: Props) {
  const [editando, setEditando] = useState(false);
  const montoLiq = venta.precioCosto + (venta.precioVentaReal - venta.precioCosto) / 3;

  if (editando) {
    return (
      <div className="bg-blue-50 rounded-md p-2 text-xs space-y-2">
        <form action={async (fd) => { await actualizarVentaConsignacion(fd); setEditando(false); }}
          className="space-y-2">
          <input type="hidden" name="id" value={venta.id} />
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <label className="text-gray-500">Cantidad</label>
              <input name="cantidad" type="number" min={1} max={venta.maxCantidad} step={1}
                defaultValue={venta.cantidad}
                className="block w-20 rounded border border-gray-300 px-2 py-1" />
            </div>
            <div>
              <label className="text-gray-500">Precio real de venta</label>
              <input name="precioVentaReal" type="number" min={0} step={0.01}
                defaultValue={venta.precioVentaReal}
                className="block w-32 rounded border border-gray-300 px-2 py-1" />
            </div>
            <div className="flex-1">
              <label className="text-gray-500">N° Factura</label>
              <div className="flex gap-1 items-center">
                <input type="checkbox" name="facturado" defaultChecked={venta.facturado} />
                <input name="numeroFactura" defaultValue={venta.numeroFactura ?? ""}
                  placeholder="N° factura"
                  className="block w-full rounded border border-gray-300 px-2 py-1" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit"
              className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700">
              Guardar
            </button>
            <button type="button" onClick={() => setEditando(false)}
              className="rounded border border-gray-300 px-3 py-1 text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center text-xs text-gray-600 group">
      <div className="flex items-center gap-2">
        <span>{new Date(venta.fecha).toLocaleDateString("es-AR")} · {venta.cantidad} u. a {fmt(venta.precioVentaReal)}</span>
        {!venta.liquidacionId && (
          <button onClick={() => setEditando(true)}
            className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 transition-opacity">
            Editar
          </button>
        )}
      </div>
      <span className="text-gray-400">
        A liquidar: {fmt(montoLiq * venta.cantidad)} · {venta.liquidacionId ? "Liquidado" : "Pendiente"}
        {venta.facturado && venta.numeroFactura && ` · F: ${venta.numeroFactura}`}
      </span>
    </div>
  );
}
