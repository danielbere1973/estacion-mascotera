"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { eliminarVenta } from "./actions";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: Date) => {
  const utc = new Date(d);
  return `${String(utc.getUTCDate()).padStart(2, "0")}/${String(utc.getUTCMonth() + 1).padStart(2, "0")}/${String(utc.getUTCFullYear()).slice(-2)}`;
};

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
  ventaConsignacion: {
    detalle: {
      precioCosto: string;
      precioPiso: string;
    };
  } | null;
};

export type VentaRow = {
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
  pagos: { monto: string }[];
};

// Totales de una venta (también se usan para ordenar la tabla de Ventas).
export function calcularTotalesVenta(venta: VentaRow) {
  const total = venta.detalles.reduce(
    (acc, d) => acc + d.cantidad * Number(d.precioVentaUnitario),
    0
  );
  const descuento = venta.detalles.reduce(
    (acc, d) =>
      acc + d.cantidad * Number(d.precioVentaUnitario) * (Number(d.descuentoPorcentaje) / 100),
    0
  );
  const costoMercaderia = venta.detalles.reduce((acc, d) => {
    const precioVenta = Number(d.precioVentaUnitario) * (1 - Number(d.descuentoPorcentaje) / 100);
    if (d.ventaConsignacion) {
      // Producto de consignación: costo efectivo = precioCosto + 1/3 * (precioVenta - precioCosto)
      const costo = Number(d.ventaConsignacion.detalle.precioCosto);
      const costoEfectivo = costo + (precioVenta - costo) / 3;
      return acc + d.cantidad * costoEfectivo;
    }
    return acc + d.cantidad * Number(d.precioCostoUnitario ?? d.producto.precioCostoUnitario);
  }, 0);
  const costosCobranza = venta.costos.reduce((acc, c) => acc + Number(c.montoCalculado), 0);
  const totalAbonado = total - descuento + Number(venta.costoEnvio);
  const ganancia = total - descuento - costoMercaderia - Number(venta.costoEnvio) - costosCobranza;
  const pctGanancia = totalAbonado > 0 ? (ganancia / totalAbonado) * 100 : null;
  const pctSobreCosto = costoMercaderia > 0 ? (ganancia / costoMercaderia) * 100 : null;
  return { total, descuento, costoMercaderia, costosCobranza, totalAbonado, ganancia, pctGanancia, pctSobreCosto };
}

// Estado de cobro según lo pagado contra el total abonado.
function estadoPagoVenta(venta: VentaRow, totalAbonado: number) {
  const totalPagado = venta.pagos.reduce((acc, p) => acc + Number(p.monto), 0);
  const estado =
    totalPagado <= 0 ? "Pendiente de pago" : totalPagado >= totalAbonado - 0.01 ? "Cobrado" : "Parcialmente pagado";
  const clase =
    estado === "Cobrado"
      ? "bg-green-100 text-green-700"
      : estado === "Parcialmente pagado"
        ? "bg-blue-100 text-blue-700"
        : "bg-amber-100 text-amber-700";
  return { estado, clase };
}

function documentoCliente(venta: VentaRow) {
  return {
    docLabel: venta.cliente.cuit ? "CUIT" : venta.cliente.dni ? "DNI" : null,
    docValue: venta.cliente.cuit ?? venta.cliente.dni ?? null,
  };
}

function AccionesVenta({ ventaId, className }: { ventaId: number; className: string }) {
  return (
    <>
      <Link href={`/ventas/${ventaId}/editar`} className={`${className} text-blue-600 hover:bg-blue-50`}>
        Editar
      </Link>
      <form action={eliminarVenta} className="contents">
        <input type="hidden" name="id" value={ventaId} />
        <ConfirmSubmitButton
          confirmMessage="¿Eliminar esta venta? Se devolverá el stock de los productos vendidos."
          className={`${className} text-red-500 hover:bg-red-50`}
        >
          Eliminar
        </ConfirmSubmitButton>
      </form>
    </>
  );
}

// Versión mobile de la fila: tarjeta con los datos principales; al tocarla muestra el detalle.
export function VentaCard({ venta, esRestringido }: { venta: VentaRow; esRestringido: boolean }) {
  const [open, setOpen] = useState(false);
  const { descuento, costosCobranza, totalAbonado, ganancia, pctGanancia } = calcularTotalesVenta(venta);
  const { estado, clase } = estadoPagoVenta(venta, totalAbonado);
  const { docLabel, docValue } = documentoCliente(venta);

  return (
    <li className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
      <button type="button" onClick={() => setOpen((o) => !o)} className="block w-full p-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-gray-900">
            {venta.cliente.nombre} {venta.cliente.apellido}
          </p>
          <span className="shrink-0 text-sm text-gray-500">{fmtDate(venta.fechaVenta)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-lg font-bold text-blue-600">{fmt(totalAbonado)}</span>
          {!esRestringido && (
            <span className={`text-sm font-semibold ${ganancia >= 0 ? "text-green-600" : "text-red-500"}`}>
              Gan. {fmt(ganancia)}
              {pctGanancia !== null && (
                <span className="ml-1 text-xs font-normal opacity-70">{pctGanancia.toFixed(1)}%</span>
              )}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {venta.facturado ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Facturado{venta.numeroFactura ? ` · ${venta.numeroFactura}` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Sin facturar</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${clase}`}>{estado}</span>
          <span className="ml-auto text-xs text-blue-600">{open ? "Ocultar ▲" : "Ver detalle ▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2 text-sm">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Canal</dt>
              <dd className="text-gray-800">{CANAL_LABELS[venta.canalVenta] ?? venta.canalVenta}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Medio de pago</dt>
              <dd className="text-gray-800">{venta.medioPago}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{docLabel ?? "Doc."}</dt>
              <dd className="font-mono text-gray-800">{docValue ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Descuento</dt>
              <dd className="text-gray-800">{descuento > 0 ? `− ${fmt(descuento)}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Envío + costos</dt>
              <dd className="text-gray-800">{fmt(Number(venta.costoEnvio) + costosCobranza)}</dd>
            </div>
          </dl>

          <ul className="mt-3 divide-y divide-gray-100 rounded-lg bg-gray-50">
            {venta.detalles.map((d) => {
              const precioUnit = Number(d.precioVentaUnitario);
              const subtotal = d.cantidad * precioUnit * (1 - Number(d.descuentoPorcentaje) / 100);
              return (
                <li key={d.id} className="flex items-start justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-gray-800">{d.producto.nombre}</p>
                    <p className="text-xs text-gray-500">
                      {d.cantidad} × {fmt(precioUnit)}
                      {d.producto.skuInterno ? ` · ${d.producto.skuInterno}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-gray-800">{fmt(subtotal)}</span>
                </li>
              );
            })}
          </ul>

          {!esRestringido && (
            <div className="mt-3 flex gap-2">
              <AccionesVenta
                ventaId={venta.id}
                className="flex-1 rounded-md bg-gray-100 py-2 text-center text-sm font-medium"
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function VentaExpandibleRow({
  venta,
  esRestringido,
}: {
  venta: VentaRow;
  esRestringido: boolean;
}) {
  const [open, setOpen] = useState(false);

  const { total, descuento, costosCobranza, totalAbonado, ganancia, pctGanancia, pctSobreCosto } =
    calcularTotalesVenta(venta);

  const { estado: estadoPago, clase: estadoPagoClase } = estadoPagoVenta(venta, totalAbonado);
  const { docLabel, docValue } = documentoCliente(venta);

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
            {pctGanancia !== null && (
              <span className="ml-1 text-xs font-normal opacity-70">
                {pctGanancia.toFixed(1)}% vta
              </span>
            )}
            {pctSobreCosto !== null && (
              <span className="ml-1 text-xs font-normal opacity-50">
                · {pctSobreCosto.toFixed(1)}% costo
              </span>
            )}
          </td>
        )}
        <td className="whitespace-nowrap px-3 py-2 space-x-1">
          {venta.facturado ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Sí{venta.numeroFactura ? ` · ${venta.numeroFactura}` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">No</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoPagoClase}`}>
            {estadoPago}
          </span>
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
                  <AccionesVenta
                    ventaId={venta.id}
                    className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium"
                  />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
