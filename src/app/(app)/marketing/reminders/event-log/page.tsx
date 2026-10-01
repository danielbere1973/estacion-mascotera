import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";
import { FiltroFechas } from "./filtro-fechas";

const TZ = "America/Argentina/Buenos_Aires";
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const formatoHora = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

// "2026-10-01" → "01/10/2026"
function diaLegible(dia: string) {
  const [anio, mes, d] = dia.split("-");
  return `${d}/${mes}/${anio}`;
}

export default async function EventLogPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireAdmin();

  // Rango de días en hora Argentina (UTC-3), ambos extremos incluidos.
  const params = await searchParams;
  const desde = params.desde && DIA_RE.test(params.desde) ? params.desde : "";
  const hasta = params.hasta && DIA_RE.test(params.hasta) ? params.hasta : "";
  const fecha: Prisma.DateTimeFilter = {};
  if (desde) fecha.gte = new Date(`${desde}T00:00:00.000-03:00`);
  if (hasta) fecha.lte = new Date(`${hasta}T23:59:59.999-03:00`);

  const rango =
    desde && hasta
      ? `del ${diaLegible(desde)} al ${diaLegible(hasta)}`
      : desde
        ? `desde el ${diaLegible(desde)}`
        : hasta
          ? `hasta el ${diaLegible(hasta)}`
          : null;

  const eventos = await prisma.logMarketing.findMany({
    where: desde || hasta ? { fecha } : undefined,
    orderBy: { fecha: "desc" },
    take: 500,
    include: { usuario: { select: { nombre: true, apellido: true } } },
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Marketing — Reminders: Event log</h1>
        <p className="mt-1 text-sm text-gray-500">
          {rango ? (
            <>
              Mostrando {eventos.length} eventos <span className="font-medium text-gray-700">{rango}</span>, del
              más reciente al más antiguo.
            </>
          ) : (
            <>Últimos {eventos.length} eventos, del más reciente al más antiguo.</>
          )}
        </p>
      </div>
      <FiltroFechas desde={desde} hasta={hasta} />
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Hora</th>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Acción</th>
              <th className="px-3 py-2">Detalle</th>
              <th className="px-3 py-2">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {eventos.map((e) => (
              // El resumen de cada envío de reminders va en negrita para distinguirlo de los envíos individuales.
              <tr
                key={e.id}
                className={`hover:bg-gray-50 ${e.accion === "Envío de reminders" ? "font-bold text-gray-900" : ""}`}
              >
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatoFecha.format(e.fecha)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatoHora.format(e.fecha)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {e.usuario.nombre} {e.usuario.apellido}
                </td>
                <td className={`whitespace-nowrap px-3 py-2 ${e.accion === "Envío de reminders" ? "" : "font-medium"}`}>
                  {e.accion}
                </td>
                <td className="px-3 py-2 text-gray-600">{e.detalle ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.resultado === "OK" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {e.resultado}
                  </span>
                </td>
              </tr>
            ))}
            {eventos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  {rango ? "No hay eventos en ese rango de fechas." : "Todavía no hay eventos registrados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
