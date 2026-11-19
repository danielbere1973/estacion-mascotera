import Link from "next/link";
import { perfilAcceso, requireSinRestriccion } from "@/lib/permissions";
import { formatCurrency } from "@/lib/format";
import { formatoKm } from "@/lib/km-recorridos";
import { ESTADO_LABEL, formatoDuracion, traerConductores, traerRecorridos } from "@/lib/recorridos-logistica";
import { BotonExportar } from "@/components/boton-exportar";
import { PestanasLogistica } from "../pestanas";
import { guardarVehiculo } from "./actions";

const fechaHora = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});
const hora = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const ESTADO_CLASE = {
  ACTIVO: "bg-green-100 text-green-700",
  FINALIZADO: "bg-gray-100 text-gray-600",
  VENCIDO: "bg-amber-100 text-amber-700",
} as const;

// Logística > Costos/KM: km recorridos en cada ubicación compartida y su costo estimado.
export default async function CostosKmPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; usuarioId?: string }>;
}) {
  // Con restricción de proveedores solo ve el seguimiento en vivo.
  await requireSinRestriccion("/logistica");
  const { soloLectura } = await perfilAcceso();
  const filtro = await searchParams;

  const [recorridos, conductores] = await Promise.all([traerRecorridos(filtro), traerConductores()]);

  const kmTotal = recorridos.reduce((acc, r) => acc + r.km, 0);
  const costoTotal = recorridos.reduce((acc, r) => acc + r.costo, 0);
  const hayFiltro = Boolean(filtro.desde || filtro.hasta || filtro.usuarioId);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Logística</h1>
      <PestanasLogistica activa="costos" />

      <p className="text-sm text-gray-500">
        Cada vez que se comparte la ubicación con un cliente se cuentan los km recorridos hasta que se deja de
        compartir. Es una estimación por GPS: si la pantalla se bloquea, el tramo sin señal se cuenta en línea recta.
      </p>

      {/* Costo por km de cada auto: los viajes de cada uno se calculan con su auto. */}
      <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <p className="text-sm font-medium text-gray-700">Costo por km de cada auto</p>
          <p className="text-xs text-gray-500">
            Los viajes de cada uno se calculan con el costo por km de su auto (combustible, desgaste, etc.).
          </p>
        </div>
        {conductores.length === 0 && (
          <p className="text-sm text-gray-400">Aparece cada persona después de compartir su ubicación por primera vez.</p>
        )}
        {conductores.map((c) =>
          soloLectura ? (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2 text-sm">
              <span className="font-medium text-gray-800">{c.nombre}</span>
              <span className="text-gray-700">
                {formatCurrency(c.costoPorKm)} / km · {c.auto ?? "Auto sin cargar"}
              </span>
            </div>
          ) : (
            <form
              key={c.id}
              action={guardarVehiculo}
              className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2"
            >
              <input type="hidden" name="usuarioId" value={c.id} />
              <span className="w-full text-sm font-medium text-gray-800 sm:w-40">{c.nombre}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-500">$</span>
                <input
                  name="costoPorKm"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={c.costoPorKm || ""}
                  placeholder="0"
                  required
                  aria-label={`Costo por km de ${c.nombre}`}
                  className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <span className="text-sm text-gray-500">/ km</span>
              </div>
              <input
                name="auto"
                defaultValue={c.auto ?? ""}
                placeholder="Auto (ej. Fiat Cronos 2020)"
                aria-label={`Auto de ${c.nombre}`}
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm sm:max-w-xs"
              />
              <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Guardar
              </button>
            </form>
          )
        )}
      </div>

      {/* Filtros */}
      <form method="GET" className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm md:flex md:flex-wrap md:items-center">
        <input type="date" name="desde" aria-label="Desde" defaultValue={filtro.desde} className="min-w-0 rounded-md border border-gray-300 px-2 py-1.5" />
        <input type="date" name="hasta" aria-label="Hasta" defaultValue={filtro.hasta} className="min-w-0 rounded-md border border-gray-300 px-2 py-1.5" />
        <select name="usuarioId" defaultValue={filtro.usuarioId ?? ""} className="col-span-2 rounded-md border border-gray-300 px-2 py-1.5">
          <option value="">Todos los que manejaron</option>
          {conductores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-gray-800 px-3 py-2 text-white hover:bg-gray-900 md:py-1.5">
          Filtrar
        </button>
        {hayFiltro && (
          <a href="/logistica/costos-km" className="rounded-md border border-gray-200 px-3 py-2 text-center text-gray-500 hover:bg-gray-50 md:py-1.5">
            Limpiar
          </a>
        )}
        <div className="col-span-2 md:ml-auto">
          <BotonExportar
            ruta="/api/logistica/costos-km/exportar"
            params={{ desde: filtro.desde ?? "", hasta: filtro.hasta ?? "", usuarioId: filtro.usuarioId ?? "" }}
          />
        </div>
      </form>

      {/* Totales */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold text-gray-900">{recorridos.length}</p>
          <p className="text-xs text-gray-500">recorridos</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold text-gray-900">{formatoKm(kmTotal)}</p>
          <p className="text-xs text-gray-500">en total</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(costoTotal)}</p>
          <p className="text-xs text-gray-500">costo estimado</p>
        </div>
      </div>

      {/* Mobile: tarjetas */}
      <ul className="space-y-2 md:hidden">
        {recorridos.map((r) => (
          <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">
                  {r.ventaId != null && (
                    <Link href={`/ventas/${r.ventaId}/editar`} className="mr-1 text-blue-600">
                      #{r.ventaId}
                    </Link>
                  )}
                  {r.cliente}
                </p>
                <p className="text-xs text-gray-500">
                  {fechaHora.format(r.inicio)} · {r.usuario}
                  {r.auto && ` (${r.auto})`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-gray-900">{formatoKm(r.km)}</p>
                <p className="text-xs text-gray-500">{formatCurrency(r.costo)}</p>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
              <span>{formatoDuracion(r.minutos)}</span>
              <span className={`rounded-full px-2 py-0.5 ${ESTADO_CLASE[r.estado]}`}>{ESTADO_LABEL[r.estado]}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Venta</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Manejó</th>
              <th className="px-3 py-2">Auto</th>
              <th className="px-3 py-2">Horario</th>
              <th className="px-3 py-2">Duración</th>
              <th className="px-3 py-2 text-right">Km</th>
              <th className="px-3 py-2 text-right">Costo estimado</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recorridos.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2">{fechaHora.format(r.inicio).split(",")[0]}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {r.ventaId != null ? (
                    <Link href={`/ventas/${r.ventaId}/editar`} className="text-blue-600 hover:underline">
                      #{r.ventaId}
                    </Link>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2 font-medium">{r.cliente}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.usuario}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.auto ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                  {hora.format(r.inicio)} – {r.estado === "ACTIVO" ? "en curso" : hora.format(r.fin)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatoDuracion(r.minutos)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{formatoKm(r.km)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right" title={`${formatCurrency(r.costoPorKm)} / km`}>
                  {formatCurrency(r.costo)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${ESTADO_CLASE[r.estado]}`}>{ESTADO_LABEL[r.estado]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {recorridos.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
          {hayFiltro ? "No hay recorridos con esos filtros." : "Todavía no hay recorridos registrados."}
        </p>
      )}
    </div>
  );
}
