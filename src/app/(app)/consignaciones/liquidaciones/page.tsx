import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { registrarPagoLiquidacion } from "../actions";

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
          <div key={liq.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <Link href={`/consignaciones/liquidaciones/${liq.id}`}
                className="font-medium text-sm text-gray-900 hover:text-blue-600">
                #{liq.id} · {liq.socio.nombre}
              </Link>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(liq.fechaDesde).toLocaleDateString("es-AR")} → {new Date(liq.fechaHasta).toLocaleDateString("es-AR")}
                {" · "}generada {new Date(liq.fecha).toLocaleDateString("es-AR")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold ${Number(liq.saldo) >= 0 ? "text-green-700" : "text-red-600"}`}>
                {fmt(Number(liq.saldo))}
              </span>
              {liq.pagado ? (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Pagada</span>
              ) : (
                <form action={registrarPagoLiquidacion}>
                  <input type="hidden" name="id" value={liq.id} />
                  <button type="submit"
                    className="rounded-md bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">
                    Marcar pagada
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
        {liquidaciones.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">No hay liquidaciones generadas.</p>
        )}
      </div>
    </div>
  );
}
