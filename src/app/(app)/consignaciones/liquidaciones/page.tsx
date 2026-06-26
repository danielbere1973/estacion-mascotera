import Link from "next/link";
import { prisma } from "@/lib/prisma";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export default async function LiquidacionesPage() {
  const liquidaciones = await prisma.liquidacionConsignacion.findMany({
    include: { socio: { select: { nombre: true } } },
    orderBy: { fecha: "desc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Liquidaciones</h1>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {liquidaciones.map((liq) => (
          <Link key={liq.id} href={`/consignaciones/liquidaciones/${liq.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <div>
              <span className="font-medium text-sm text-gray-900">
                #{liq.id} · {liq.socio.nombre}
              </span>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(liq.fechaDesde).toLocaleDateString("es-AR")} → {new Date(liq.fechaHasta).toLocaleDateString("es-AR")}
                {" · "}generada {new Date(liq.fecha).toLocaleDateString("es-AR")}
              </p>
            </div>
            <div className="flex items-center gap-3">
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
