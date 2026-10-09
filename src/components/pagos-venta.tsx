"use client";

import { useState } from "react";
import { ConfirmSubmitButton } from "@/components/confirm-button";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

const fmtDate = (d: string | Date) => {
  const utc = new Date(d);
  return `${String(utc.getUTCDate()).padStart(2, "0")}/${String(utc.getUTCMonth() + 1).padStart(2, "0")}/${String(utc.getUTCFullYear()).slice(-2)}`;
};

type Usuario = { id: number; nombre: string; apellido: string };
type MedioPago = { id: number; nombre: string };

type Pago = {
  id: number;
  monto: string;
  comision: string;
  medioPago: string;
  fechaPago: string | Date;
  fechaAcreditacion: string | Date | null;
  descripcion: string | null;
  cobradoPor: { nombre: string; apellido: string } | null;
};

export function PagosVenta({
  ventaId,
  pagos,
  totalACobrar,
  usuarios,
  mediosPago,
  agregarPagoVenta,
  eliminarPagoVenta,
}: {
  ventaId: number;
  pagos: Pago[];
  totalACobrar: number;
  usuarios: Usuario[];
  mediosPago: MedioPago[];
  agregarPagoVenta: (formData: FormData) => Promise<void>;
  eliminarPagoVenta: (formData: FormData) => Promise<void>;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);

  const totalPagado = pagos.reduce((acc, p) => acc + Number(p.monto), 0);
  const saldoPendiente = Math.max(totalACobrar - totalPagado, 0);
  const estado =
    totalPagado <= 0 ? "Pendiente de pago" : totalPagado >= totalACobrar - 0.01 ? "Cobrado" : "Parcialmente pagado";
  const estadoClase =
    estado === "Cobrado"
      ? "bg-green-100 text-green-700"
      : estado === "Parcialmente pagado"
        ? "bg-blue-100 text-blue-700"
        : "bg-amber-100 text-amber-700";

  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Pagos</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoClase}`}>{estado}</span>
      </div>

      {/* Mobile: un renglón por pago. */}
      {pagos.length > 0 && (
        <ul className="divide-y divide-gray-100 text-sm md:hidden">
          {pagos.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-gray-800">
                  {fmtDate(p.fechaPago)} · {p.medioPago}
                </p>
                <p className="text-xs text-gray-500">
                  {Number(p.comision) > 0 && <>Comisión {fmt(Number(p.comision))} · </>}
                  Acred. {p.fechaAcreditacion ? fmtDate(p.fechaAcreditacion) : "—"}
                  {p.cobradoPor && <> · {p.cobradoPor.apellido}, {p.cobradoPor.nombre}</>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold text-gray-900">{fmt(Number(p.monto))}</span>
                <form action={eliminarPagoVenta}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="ventaId" value={ventaId} />
                  <ConfirmSubmitButton
                    confirmMessage="¿Eliminar este pago?"
                    className="rounded-md px-2 py-1 text-red-500 hover:bg-red-50"
                  >
                    ✕
                  </ConfirmSubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pagos.length > 0 && (
        <table className="hidden w-full text-xs md:table">
          <thead>
            <tr className="text-left text-gray-400">
              <th className="pb-1 font-normal">Fecha</th>
              <th className="pb-1 font-normal">Medio</th>
              <th className="pb-1 font-normal text-right">Monto</th>
              <th className="pb-1 font-normal text-right">Comisión</th>
              <th className="pb-1 font-normal">Acreditación</th>
              <th className="pb-1 font-normal">Cobrado por</th>
              <th className="pb-1"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagos.map((p) => (
              <tr key={p.id}>
                <td className="py-1">{fmtDate(p.fechaPago)}</td>
                <td className="py-1">{p.medioPago}</td>
                <td className="py-1 text-right font-medium">{fmt(Number(p.monto))}</td>
                <td className="py-1 text-right text-gray-500">
                  {Number(p.comision) > 0 ? fmt(Number(p.comision)) : "—"}
                </td>
                <td className="py-1">{p.fechaAcreditacion ? fmtDate(p.fechaAcreditacion) : "—"}</td>
                <td className="py-1">{p.cobradoPor ? `${p.cobradoPor.apellido}, ${p.cobradoPor.nombre}` : "—"}</td>
                <td className="py-1 text-right">
                  <form action={eliminarPagoVenta}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="ventaId" value={ventaId} />
                    <ConfirmSubmitButton
                      confirmMessage="¿Eliminar este pago?"
                      className="text-red-500 hover:underline"
                    >
                      ✕
                    </ConfirmSubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-gray-500">
        <span>
          Pagado: {fmt(totalPagado)} de {fmt(totalACobrar)}
        </span>
        {saldoPendiente > 0 && <span>Saldo: {fmt(saldoPendiente)}</span>}
      </div>

      {saldoPendiente > 0.01 && (
        <>
          {!mostrarForm ? (
            <button
              type="button"
              onClick={() => setMostrarForm(true)}
              className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              + Agregar pago
            </button>
          ) : (
            <form
              action={async (formData) => {
                await agregarPagoVenta(formData);
                setMostrarForm(false);
              }}
              className="space-y-2 rounded-md p-2 ring-1 ring-gray-200 md:bg-gray-50 md:ring-0"
            >
              <input type="hidden" name="ventaId" value={ventaId} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium text-gray-500">Monto</label>
                  <input
                    type="number"
                    name="monto"
                    min={0.01}
                    step="0.01"
                    max={saldoPendiente}
                    required
                    defaultValue={saldoPendiente.toFixed(2)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium text-gray-500">Comisión $</label>
                  <input
                    type="number"
                    name="comision"
                    min={0}
                    step="0.01"
                    defaultValue={0}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium text-gray-500">Medio de pago</label>
                  <select name="medioPago" required defaultValue="" className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs">
                    <option value="" disabled>Seleccionar...</option>
                    {mediosPago.map((m) => (
                      <option key={m.id} value={m.nombre}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium text-gray-500">Fecha de pago</label>
                  <input
                    type="date"
                    name="fechaPago"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    required
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium text-gray-500">Fecha de acreditación</label>
                  <input
                    type="date"
                    name="fechaAcreditacion"
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium text-gray-500">Cobrado por</label>
                  <select name="cobradoPorId" defaultValue="" className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs">
                    <option value="">— Sin especificar —</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>{u.apellido}, {u.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 space-y-0.5 sm:col-span-3">
                  <label className="text-[10px] font-medium text-gray-500">Detalle (opcional)</label>
                  <input
                    type="text"
                    name="descripcion"
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Registrar pago
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  className="rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
