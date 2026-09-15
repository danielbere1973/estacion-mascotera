import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { DetalleCorrida } from "./detalle-corrida";

export default async function HistorialSyncHymPage() {
  await requireAdmin();

  const corridas = await prisma.sincronizacionHym.findMany({
    orderBy: { fecha: "desc" },
    take: 60,
  });

  return (
    <div className="space-y-4 w-full">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Historial Sync HYM automático</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cada corrida del scraper (martes a sábado de madrugada) que llegó a tocar Tiendanube queda registrada
          acá con el detalle de qué cambió.{" "}
          <Link href="/mayoristas-hym" className="text-blue-600 underline hover:no-underline">
            Volver a Actualizar Stock y Precios
          </Link>
        </p>
      </div>

      {corridas.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Todavía no hay corridas automáticas registradas.
        </p>
      ) : (
        <div className="space-y-2">
          {corridas.map((c) => (
            <DetalleCorrida key={c.id} corrida={c} />
          ))}
        </div>
      )}
    </div>
  );
}
