import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { anularLiquidacion } from "../../actions";
import { ConfirmSubmitButton } from "@/components/confirm-button";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export default async function LiquidacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const liq = await prisma.liquidacionConsignacion.findUnique({
    where: { id: Number(id) },
    include: {
      socio: true,
      ventas: {
        include: { detalle: { include: { consignacion: true } } },
        orderBy: { fecha: "asc" },
      },
      pagos: {
        include: { consignacion: { select: { id: true, direccion: true } } },
        orderBy: { fecha: "asc" },
      },
    },
  });
  if (!liq) notFound();

  const saldo = Number(liq.saldo);
  const totalACobrarnos = Number(liq.totalACobrarnos);
  const totalACobrarles = Number(liq.totalACobrarles);

  // Desglose de pagos por dirección
  const pagosRecibidos = liq.pagos
    .filter(p => p.consignacion.direccion === "ENTREGAMOS")
    .reduce((s, p) => s + Number(p.monto), 0);
  const pagosRealizados = liq.pagos
    .filter(p => p.consignacion.direccion === "RECIBIMOS")
    .reduce((s, p) => s + Number(p.monto), 0);

  const pendienteACobrar = totalACobrarnos - pagosRecibidos;
  const pendienteAPagar = totalACobrarles - pagosRealizados;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/consignaciones/liquidaciones" className="text-xs text-gray-400 hover:text-gray-600">← Liquidaciones</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Liquidación #{liq.id} — {liq.socio.nombre}</h1>
          <p className="text-sm text-gray-400">
            Período: {new Date(liq.fechaDesde).toLocaleDateString("es-AR")} → {new Date(liq.fechaHasta).toLocaleDateString("es-AR")}
          </p>
        </div>
        <form action={anularLiquidacion}>
          <input type="hidden" name="id" value={liq.id} />
          <input type="hidden" name="socioId" value={liq.socioId} />
          <ConfirmSubmitButton
            confirmMessage="¿Anular esta liquidación? Las ventas y pagos volverán a quedar pendientes."
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
            Anular liquidación
          </ConfirmSubmitButton>
        </form>
      </div>

      {/* Desglose ENTREGAMOS */}
      {totalACobrarnos > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Entregamos (ellos vendieron nuestros productos)</h2>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total a cobrar (comisión + costo)</span>
            <span className="font-medium text-green-700">{fmt(totalACobrarnos)}</span>
          </div>
          {pagosRecibidos > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Pagos ya recibidos</span>
              <span className="font-medium text-gray-600">− {fmt(pagosRecibidos)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
            <span className="font-medium text-gray-700">Pendiente a cobrar</span>
            <span className={`font-semibold ${pendienteACobrar > 0 ? "text-green-700" : "text-gray-400"}`}>
              {pendienteACobrar <= 0 ? "Saldado ✓" : fmt(pendienteACobrar)}
            </span>
          </div>
        </div>
      )}

      {/* Desglose RECIBIMOS */}
      {totalACobrarles > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Recibimos (nosotros vendimos sus productos)</h2>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total a pagar (costo + 1/3 ganancia)</span>
            <span className="font-medium text-red-600">{fmt(totalACobrarles)}</span>
          </div>
          {pagosRealizados > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Pagos ya realizados</span>
              <span className="font-medium text-gray-600">− {fmt(pagosRealizados)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
            <span className="font-medium text-gray-700">Pendiente a pagar</span>
            <span className={`font-semibold ${pendienteAPagar > 0 ? "text-red-600" : "text-gray-400"}`}>
              {pendienteAPagar <= 0 ? "Saldado ✓" : fmt(pendienteAPagar)}
            </span>
          </div>
        </div>
      )}

      {/* Saldo neto */}
      <div className={`rounded-xl border p-4 text-center ${saldo > 0 ? "border-green-200 bg-green-50" : saldo < 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
        <p className="text-xs text-gray-400 mb-1">Saldo neto final</p>
        <p className={`text-2xl font-bold ${saldo > 0 ? "text-green-700" : saldo < 0 ? "text-red-600" : "text-gray-400"}`}>
          {fmt(Math.abs(saldo))}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {saldo > 0 ? "El socio nos debe" : saldo < 0 ? "Nosotros les debemos" : "En cero"}
        </p>
      </div>

      {liq.notas && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-100 px-3 py-2 text-sm text-yellow-800">
          {liq.notas}
        </div>
      )}

      {/* Detalle de ventas */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Ventas incluidas</h2>
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {liq.ventas.map((v) => {
            const esEntregamos = v.detalle.consignacion.direccion === "ENTREGAMOS";
            const costo = Number(v.detalle.precioCosto);
            const ganancia = Number(v.precioVentaReal) - costo;
            const montoLiq = (costo + ganancia / 3) * v.cantidad;
            return (
              <div key={v.id} className="flex justify-between items-center px-4 py-2.5 text-sm">
                <div>
                  <span className="text-gray-900">{v.detalle.descripcion ?? `Item #${v.detalle.id}`}</span>
                  <span className="text-gray-400 ml-2 text-xs">
                    {new Date(v.fecha).toLocaleDateString("es-AR")} · {v.cantidad} u. · Consig. #{v.detalle.consignacionId}
                  </span>
                </div>
                <span className={`font-medium ${esEntregamos ? "text-green-700" : "text-red-600"}`}>
                  {esEntregamos ? "+" : "-"}{fmt(montoLiq)}
                </span>
              </div>
            );
          })}
          {liq.ventas.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Sin ventas.</p>
          )}
        </div>
      </div>

      {/* Detalle de pagos */}
      {liq.pagos.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Pagos incluidos</h2>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {liq.pagos.map((p) => {
              const esEntregamos = p.consignacion.direccion === "ENTREGAMOS";
              return (
                <div key={p.id} className="flex justify-between items-center px-4 py-2.5 text-sm">
                  <div>
                    <span className="text-gray-900">{esEntregamos ? "Pago recibido" : "Pago realizado"}</span>
                    <span className="text-gray-400 ml-2 text-xs">
                      {new Date(p.fecha).toLocaleDateString("es-AR")} · Consig. #{p.consignacionId}
                      {p.notas && ` · ${p.notas}`}
                    </span>
                  </div>
                  <span className={`font-medium ${esEntregamos ? "text-green-700" : "text-red-600"}`}>
                    {esEntregamos ? "+" : "-"}{fmt(Number(p.monto))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
