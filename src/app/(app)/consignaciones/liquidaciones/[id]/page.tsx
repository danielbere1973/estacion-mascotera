import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { registrarPagoLiquidacion, eliminarPagoLiquidacion } from "../../actions";
import { ConfirmSubmitButton } from "@/components/confirm-button";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export default async function LiquidacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const liq = await prisma.liquidacionConsignacion.findUnique({
    where: { id: Number(id) },
    include: {
      socio: true,
      pagos: { orderBy: { fecha: "asc" } },
      ventas: {
        include: { detalle: { include: { consignacion: true } } },
        orderBy: { fecha: "asc" },
      },
    },
  });
  if (!liq) notFound();

  const saldo = Number(liq.saldo);
  const totalPagado = liq.pagos.reduce((s, p) => s + Number(p.monto), 0);
  const pendiente = Math.abs(saldo) - totalPagado;
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div>
        <Link href="/consignaciones/liquidaciones" className="text-xs text-gray-400 hover:text-gray-600">← Liquidaciones</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Liquidación #{liq.id} — {liq.socio.nombre}</h1>
        <p className="text-sm text-gray-400">
          Período: {new Date(liq.fechaDesde).toLocaleDateString("es-AR")} → {new Date(liq.fechaHasta).toLocaleDateString("es-AR")}
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-400">Nos deben</p>
          <p className="text-lg font-semibold text-green-700">{fmt(Number(liq.totalACobrarnos))}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-400">Les debemos</p>
          <p className="text-lg font-semibold text-red-600">{fmt(Number(liq.totalACobrarles))}</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${saldo > 0 ? "border-green-200 bg-green-50" : saldo < 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
          <p className="text-xs text-gray-400">Saldo neto</p>
          <p className={`text-lg font-semibold ${saldo > 0 ? "text-green-700" : saldo < 0 ? "text-red-600" : "text-gray-400"}`}>
            {fmt(Math.abs(saldo))}
          </p>
          <p className="text-xs text-gray-400">{saldo > 0 ? "nos deben" : saldo < 0 ? "les debemos" : "en cero"}</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${pendiente <= 0 ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
          <p className="text-xs text-gray-400">Pendiente de pago</p>
          <p className={`text-lg font-semibold ${pendiente <= 0 ? "text-green-700" : "text-orange-600"}`}>
            {pendiente <= 0 ? "Saldado" : fmt(pendiente)}
          </p>
          {totalPagado > 0 && <p className="text-xs text-gray-400">Pagado: {fmt(totalPagado)}</p>}
        </div>
      </div>

      {/* Pagos registrados */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Pagos</h2>
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {liq.pagos.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <span className="text-sm text-gray-900">{fmt(Number(p.monto))}</span>
                <span className="text-xs text-gray-400 ml-2">{new Date(p.fecha).toLocaleDateString("es-AR")}</span>
                {p.notas && <span className="text-xs text-gray-400 ml-2">· {p.notas}</span>}
              </div>
              <form action={eliminarPagoLiquidacion}>
                <input type="hidden" name="id" value={p.id} />
                <ConfirmSubmitButton
                  confirmMessage={`¿Eliminar pago de ${fmt(Number(p.monto))}?`}
                  className="text-xs text-red-400 hover:text-red-600">
                  Eliminar
                </ConfirmSubmitButton>
              </form>
            </div>
          ))}
          {liq.pagos.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-400 text-center">Sin pagos registrados.</p>
          )}
        </div>

        {/* Registrar pago */}
        {pendiente > 0 && (
          <form action={registrarPagoLiquidacion} className="rounded-xl border border-blue-100 bg-blue-50 p-3 flex gap-3 items-end flex-wrap">
            <input type="hidden" name="liquidacionId" value={liq.id} />
            <div>
              <label className="text-xs text-blue-700">Fecha</label>
              <input name="fecha" type="date" defaultValue={today}
                className="block rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-blue-700">Monto</label>
              <input name="monto" type="number" min={0.01} step={0.01} defaultValue={pendiente}
                className="block w-36 rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-blue-700">Notas</label>
              <input name="notas" placeholder="Transferencia, efectivo..."
                className="block w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm" />
            </div>
            <button type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap">
              Registrar pago
            </button>
          </form>
        )}
      </div>

      {liq.notas && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-100 px-3 py-2 text-sm text-yellow-800">
          {liq.notas}
        </div>
      )}

      {/* Detalle de ventas */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Movimientos incluidos</h2>
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {liq.ventas.map((v) => {
            const esEntregamos = v.detalle.consignacion.direccion === "ENTREGAMOS";
            return (
              <div key={v.id} className="flex justify-between items-center px-4 py-2.5 text-sm">
                <div>
                  <span className="text-gray-900">{v.detalle.descripcion ?? `Item #${v.detalle.id}`}</span>
                  <span className="text-gray-400 ml-2 text-xs">{new Date(v.fecha).toLocaleDateString("es-AR")} · {v.cantidad} u.</span>
                </div>
                <div className="text-right">
                  <span className={`font-medium ${esEntregamos ? "text-green-700" : "text-red-600"}`}>
                    {esEntregamos ? "+" : "-"}{fmt((Number(v.detalle.precioCosto) + (Number(v.precioVentaReal) - Number(v.detalle.precioCosto)) / 3) * v.cantidad)}
                  </span>
                </div>
              </div>
            );
          })}
          {liq.ventas.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Sin movimientos.</p>
          )}
        </div>
      </div>
    </div>
  );
}
