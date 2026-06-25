import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { registrarPagoLiquidacion } from "../../actions";

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
    },
  });
  if (!liq) notFound();

  const saldo = Number(liq.saldo);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/consignaciones/liquidaciones" className="text-xs text-gray-400 hover:text-gray-600">← Liquidaciones</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Liquidación #{liq.id} — {liq.socio.nombre}</h1>
        <p className="text-sm text-gray-400">
          Período: {new Date(liq.fechaDesde).toLocaleDateString("es-AR")} → {new Date(liq.fechaHasta).toLocaleDateString("es-AR")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-400">Nos deben (ellos vendieron)</p>
          <p className="text-lg font-semibold text-green-700">{fmt(Number(liq.totalACobrarnos))}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-400">Les debemos (nosotros vendimos)</p>
          <p className="text-lg font-semibold text-red-600">{fmt(Number(liq.totalACobrarles))}</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${saldo > 0 ? "border-green-200 bg-green-50" : saldo < 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
          <p className="text-xs text-gray-400">Saldo neto</p>
          <p className={`text-lg font-semibold ${saldo > 0 ? "text-green-700" : saldo < 0 ? "text-red-600" : "text-gray-400"}`}>
            {fmt(Math.abs(saldo))}
          </p>
          <p className="text-xs text-gray-400">{saldo > 0 ? "nos deben" : saldo < 0 ? "les debemos" : "en cero"}</p>
        </div>
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
                    {esEntregamos ? "+" : "-"}{fmt(Number(v.detalle.precioPiso) * v.cantidad)}
                  </span>
                  <span className="text-gray-400 ml-1 text-xs">(piso)</span>
                </div>
              </div>
            );
          })}
          {liq.ventas.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Sin movimientos.</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {liq.pagado ? (
          <p className="text-sm text-green-700 font-medium">
            Pagada el {liq.fechaPago ? new Date(liq.fechaPago).toLocaleDateString("es-AR") : "—"}
          </p>
        ) : (
          <form action={registrarPagoLiquidacion}>
            <input type="hidden" name="id" value={liq.id} />
            <button type="submit"
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
              Marcar como pagada
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
