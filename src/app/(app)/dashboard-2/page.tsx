import Link from "next/link";
import { FILAS_EGRESO, FILAS_INGRESO, getTotalesPeriodo } from "@/lib/cashflow";
import { getRangoFechas, parsePeriodo, PERIODOS } from "@/lib/periodo";
import { formatCurrency } from "@/lib/format";

// Dashboard 2: cuadros de plata que entra y sale en el período. Mismo cálculo que Cashflow
// (lib/cashflow.ts), así los dos coinciden para el mismo año.
export default async function Dashboard2Page({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const periodo = parsePeriodo((await searchParams).periodo);
  const totales = await getTotalesPeriodo(getRangoFechas(periodo));

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
      hint: "Plata que entra: ventas y comisión de consignaciones",
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
        <div className="flex flex-wrap gap-1">
          {PERIODOS.map((p) => (
            <Link
              key={p.key}
              href={`/dashboard-2?periodo=${p.key}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                periodo === p.key ? "bg-blue-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
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
