import Link from "next/link";
import { prisma } from "@/lib/prisma";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export default async function LiquidacionesPage() {
  const liquidaciones = await prisma.liquidacionConsignacion.findMany({
    include: { socio: { select: { nombre: true } } },
    orderBy: { fecha: "desc" },
  });

  const saldoTotal = liquidaciones
    .filter((l) => !l.pagado)
    .reduce((s, l) => s + Number(l.saldo), 0);

  return (
    <div className="w-full space-y-4">
      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/consignaciones" className="text-xs text-gray-400 hover:text-gray-600">← Consignaciones</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Liquidaciones</h1>
        </div>
        {saldoTotal !== 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center md:absolute md:left-1/2 md:-translate-x-1/2 md:border-0 md:bg-transparent md:p-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Saldo general pendiente</p>
            <p className={`text-2xl font-bold ${saldoTotal >= 0 ? "text-green-700" : "text-red-600"}`}>
              {fmt(Math.abs(saldoTotal))}
            </p>
            <p className="text-xs text-gray-400">{saldoTotal >= 0 ? "nos deben" : "les debemos"}</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {liquidaciones.map((liq) => (
          <Link key={liq.id} href={`/consignaciones/liquidaciones/${liq.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
            <div className="min-w-0">
              <span className="font-medium text-sm text-gray-900">
                #{liq.id} · {liq.socio.nombre}
              </span>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(liq.fechaDesde).toLocaleDateString("es-AR")} → {new Date(liq.fechaHasta).toLocaleDateString("es-AR")}
                <span className="hidden md:inline">{" · "}</span>
                <span className="block md:inline">generada {new Date(liq.fecha).toLocaleDateString("es-AR")}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 md:flex-row md:items-center md:gap-3">
              <span className={`text-sm font-semibold ${Number(liq.saldo) >= 0 ? "text-green-700" : "text-red-600"}`}>
                {fmt(Math.abs(Number(liq.saldo)))}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${liq.pagado ? "bg-gray-100 text-gray-500" : "bg-orange-100 text-orange-700"}`}>
                {liq.pagado ? "Saldada" : "Pendiente"}
              </span>
            </div>
          </Link>
        ))}
        {liquidaciones.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">No hay liquidaciones generadas.</p>
        )}
      </div>
    </div>
  );
}
