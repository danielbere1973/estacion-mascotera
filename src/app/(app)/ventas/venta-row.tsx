"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { eliminarVenta } from "./actions";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

const CANAL_LABELS: Record<string, string> = {
  TIENDANUBE: "Tiendanube",
  WHATSAPP: "WhatsApp",
  TELEFONO: "Teléfono",
};

type DetalleVenta = {
  id: number;
  cantidad: number;
  precioVentaUnitario: string;
  descuentoPorcentaje: string;
  precioCostoUnitario: string | null;
  producto: {
    skuInterno: string | null;
    nombre: string;
    precioCostoUnitario: string;
  };
};

type VentaRow = {
  id: number;
  fechaVenta: Date;
  canalVenta: string;
  medioPago: string;
  costoEnvio: string;
  facturado: boolean;
  numeroFactura: string | null;
  cliente: {
    nombre: string;
    apellido: string;
    cuit: string | null;
    dni: string | null;
  };
  detalles: DetalleVenta[];
  costos: { montoCalculado: string }[];
};

export function VentaExpandibleRow({
  venta,
  esRestringido,
}: {
  venta: VentaRow;
  esRestringido: boolean;
}) {
  const [open, setOpen] = useState(false);

  const total = venta.detalles.reduce(
    (acc, d) => acc + d.cantidad * Number(d.precioVentaUnitario),
    0
  );
  const descuento = venta.detalles.reduce(
    (acc, d) =>
      acc + d.cantidad * Number(d.precioVentaUnitario) * (Number(d.descuentoPorcentaje) / 100),
    0
  );
  const costoMercaderia = venta.detalles.reduce(
    (acc, d) => acc + d.cantidad * Number(d.precioCostoUnitario ?? d.producto.precioCostoUnitario),
    0
  );
  const costosCobranza = venta.costos.reduce((acc, c) => acc + Number(c.montoCalculado), 0);
  const totalAbonado = total - descuento + Number(venta.costoEnvio);
  const ganancia = total - descuento - costoMercaderia - Number(venta.costoEnvio) - costosCobranza;

  const docLabel = venta.cliente.cuit ? "CUIT" : venta.cliente.dni ? "DNI" : null;
  const docValue = venta.cliente.cuit ?? venta.cliente.dni ?? null;

  return (
    <>
      <tr className={`hover:bg-gray-50 ${open ? "bg-gray-50" : ""}`}>
        <td className="px-3 py-2">
          <button
            onClick={() => setOpen((o) => !o)}
            className={`flex h-5 w-5 items-center justify-center rounded border text-xs font-bold transition-all ${
              open
                ? "border-blue-500 bg-blue-500 text-white rotate-45"
                : "border-gray-300 bg-white text-gray-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
            }`}
          >
            +
          </button>
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-gray-500 text-sm">
          {fmtDate(venta.fechaVenta)}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-sm">
          {venta.cliente.nombre} {venta.cliente.apellido}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-medium">
          {fmt(total)}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-bold text-blue-600">
          {fmt(totalAbonado)}
        </td>
        {!esRestringido && (
          <td className={`whitespace-nowrap px-3 py-2 text-right text-sm font-semibold ${ganancia >= 0 ? "text-green-600" : "text-red-500"}`}>
            {fmt(ganancia)}
          </td>
        )}
        <td className="whitespace-nowrap px-3 py-2">
          {venta.facturado ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Sí{venta.numeroFactura ? ` · ${venta.numeroFactura}` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">No</span>
          )}
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={esRestringido ? 6 : 7} className="px-4 pb-3 pt-0 bg-blue-50">
            <div className="rounded-lg border border-blue-100 bg-white overflow-hidden">

              {/* Fila de datos secundarios */}
              <div className="grid grid-cols-5 divide-x divide-gray-100 border-b border-gray-100">
                <div className="px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Canal</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{CANAL_LABELS[venta.canalVenta] ?? venta.canalVenta}</p>
                </div>
                <div className="px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Medio de pago</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{venta.medioPago}</p>
                </div>
                <div className="px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    {docLabel ?? "Doc."}
                  </p>
                  <p className={`text-sm mt-0.5 font-mono ${docValue ? "font-medium text-gray-800" : "text-gray-300"}`}>
                    {docValue ?? "—"}
                  </p>
                </div>
                <div className="px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Descuento</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">
                    {descuento > 0 ? `− ${fmt(descuento)}` : "—"}
                  </p>
                </div>
                <div className="px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Envío + costos</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">
                    {fmt(Number(venta.costoEnvio) + costosCobranza)}
                  </p>
                </div>
              </div>

              {/* Tabla productos */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 w-20">SKU</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Descripción</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 text-center w-16">Cant.</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 text-right w-28">Precio unit.</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 text-right w-28">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {venta.detalles.map((d) => {
                    const precioUnit = Number(d.precioVentaUnitario);
                    const descPct = Number(d.descuentoPorcentaje);
                    const subtotal = d.cantidad * precioUnit * (1 - descPct / 100);
                    return (
                      <tr key={d.id}>
                        <td className="px-3 py-2 font-mono text-xs text-gray-400">{d.producto.skuInterno ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-800">{d.producto.nombre}</td>
                        <td className="px-3 py-2 text-center text-gray-700">{d.cantidad}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(precioUnit)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(subtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Acciones */}
              {!esRestringido && (
                <div className="flex gap-2 border-t border-gray-100 bg-gray-50 px-3 py-2">
                  <Link
                    href={`/ventas/${venta.id}/editar`}
                    className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                  >
                    Editar
                  </Link>
                  <form action={eliminarVenta}>
                    <input type="hidden" name="id" value={venta.id} />
                    <ConfirmSubmitButton
                      confirmMessage="¿Eliminar esta venta? Se devolverá el stock de los productos vendidos."
                      className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                    >
                      Eliminar
                    </ConfirmSubmitButton>
                  </form>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
