import { FILAS_EGRESO, FILAS_INGRESO, getTotalesPeriodo } from "@/lib/cashflow";
import { formatCurrency } from "@/lib/format";

// Fechas del filtro como "AAAA-MM-DD" (lo que usa <input type="date">). Se interpretan en UTC,
// igual que los cortes de mes del Dashboard y del Cashflow.
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const aIso = (d: Date) => d.toISOString().slice(0, 10);
function leerFecha(valor: string | undefined): Date | null {
  if (!valor || !FECHA.test(valor)) return null;
  const d = new Date(`${valor}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Dashboard 2: cuadros de plata que entra y sale en el período. Mismo cálculo que Cashflow
// (lib/cashflow.ts), así los dos coinciden para el mismo año.
export default async function Dashboard2Page({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const params = await searchParams;
  // Sin fechas elegidas: desde el 1 del mes actual hasta hoy.
  // "Hoy" con la fecha de Argentina (de noche en UTC ya es el día siguiente).
  const hoyAr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const hoy = new Date(`${hoyAr}T00:00:00Z`);
  let desde = leerFecha(params.desde) ?? new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  let hasta = leerFecha(params.hasta) ?? hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  // "Hasta" incluye ese día completo.
  const hastaExclusivo = new Date(hasta.getTime() + 24 * 60 * 60 * 1000);
  const totales = await getTotalesPeriodo({ desde, hasta: hastaExclusivo });

  const desgloseIngresos = FILAS_INGRESO.map((f) => ({ label: f.label, monto: totales[f.clave] }));
  const desgloseEgresos = FILAS_EGRESO.map((f) => ({ label: f.label, monto: totales[f.clave] }));
  const totalIngresos = desgloseIngresos.reduce((acc, d) => acc + d.monto, 0);
  const totalEgresos = desgloseEgresos.reduce((acc, d) => acc + d.monto, 0);
  const rentabilidadNeta = totalIngresos - totalEgresos;
  const pctRentabilidad = totalIngresos > 0 ? (rentabilidadNeta / totalIngresos) * 100 : null;

  const cuadros = [
    {
      label: "Total de Ingresos",
      valor: totalIngresos,
      color: "text-green-700",
      hint: "Plata que entra: ventas (incluidas las internas) y comisión de consignaciones",
      desglose: desgloseIngresos,
    },
    {
      label: "Total de Egresos",
      valor: totalEgresos,
      color: "text-red-600",
      hint: "Plata que sale: compras de mercadería, comisiones de cobro y todos los gastos",
      desglose: desgloseEgresos,
    },
    {
      label: "Rentabilidad Neta",
      valor: rentabilidadNeta,
      color: rentabilidadNeta >= 0 ? "text-green-700" : "text-red-600",
      hint: "Total de Ingresos − Total de Egresos",
      pct: pctRentabilidad,
      desglose: [
        { label: "Total de Ingresos", monto: totalIngresos },
        { label: "Total de Egresos", monto: -totalEgresos },
      ],
    },
  ];

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard 2</h1>
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-gray-500">Desde</span>
            <input
              type="date"
              name="desde"
              defaultValue={aIso(desde)}
              required
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-gray-500">Hasta</span>
            <input
              type="date"
              name="hasta"
              defaultValue={aIso(hasta)}
              required
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
            Aplicar
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cuadros.map((c) => (
          <div key={c.label} className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">{c.label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className={`text-2xl font-semibold tabular-nums ${c.color}`}>{formatCurrency(c.valor)}</p>
              {c.pct != null && <span className={`text-sm font-medium ${c.color}`}>{c.pct.toFixed(1)}%</span>}
            </div>
            <p className="mt-1 text-xs text-gray-400">{c.hint}</p>
            <dl className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs">
              {c.desglose.map((d) => (
                <div key={d.label} className="flex justify-between gap-2">
                  <dt className="text-gray-500">{d.label}</dt>
                  <dd className="tabular-nums text-gray-700">{formatCurrency(d.monto)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
