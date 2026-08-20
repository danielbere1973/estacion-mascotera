import Link from "next/link";
import { auth } from "@/auth";
import { getDashboardMetrics, getDashboardMetricsRestringido } from "@/lib/metrics";
import { getRangoFechas, parsePeriodo, PERIODOS, type PeriodoKey } from "@/lib/periodo";
import { formatCurrency } from "@/lib/format";
import { GastosPieChart } from "@/components/gastos-pie-chart";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const params = await searchParams;
  const periodo = parsePeriodo(params.periodo);
  const rango = getRangoFechas(periodo);
  const session = await auth();
  const esRestringido = session?.user?.rol === "LECTOR_RESTRINGIDO";
  const metrics =
    esRestringido && session?.user?.proveedorRestrictoId
      ? await getDashboardMetricsRestringido(rango, session.user.proveedorRestrictoId)
      : await getDashboardMetrics(rango);

  const pctOperativa = metrics.totalIngresosConsolidados > 0
    ? (metrics.rentabilidadSinFijos / metrics.totalIngresosConsolidados) * 100
    : null;
  const pctNeta = metrics.totalIngresosConsolidados > 0
    ? (metrics.rentabilidadNeta / metrics.totalIngresosConsolidados) * 100
    : null;

  const cards = [
    {
      label: "Total Ingresos",
      value: metrics.totalIngresosConsolidados,
      hint: "Ventas propias + comisión consignaciones",
      highlight: true,
      pct: null as number | null,
    },
    {
      label: "Rentabilidad Operativa",
      value: metrics.rentabilidadSinFijos,
      hint: "Ingresos − costo mercadería − comisiones − envíos − gastos variables",
      highlight: true,
      pct: pctOperativa,
    },
    {
      label: "Rentabilidad Neta",
      value: metrics.rentabilidadNeta,
      hint: "Rentabilidad operativa − gastos fijos, marketing y excepcionales",
      highlight: true,
      pct: pctNeta,
    },
    {
      label: "Gastos Fijos del período",
      value: metrics.totalGastosFijosDelPeriodo,
      hint: "Impactan rentabilidad neta pero no operativa",
      pct: null as number | null,
    },
    {
      label: "Gastos Excepcionales",
      value: metrics.totalGastosExcepcionales,
      hint: "Pagos únicos o infrecuentes — impactan rentabilidad neta pero no operativa",
      pct: null as number | null,
    },
    {
      label: "Total Gastado",
      value: metrics.totalGastado,
      hint: "Compras + todos los gastos",
      pct: null as number | null,
    },
    {
      label: "Valor de Stock",
      value: metrics.valorStock,
      hint: "Stock actual a precio de costo",
      pct: null as number | null,
    },
    {
      label: "Total Facturado",
      value: metrics.totalFacturado,
      hint: "Ventas propias + comisión neta de consignaciones",
      pct: null as number | null,
    },
    {
      label: "Ganancia Consignaciones",
      value: metrics.gananciaConsignaciones,
      hint: "2/3 de la ganancia en ventas por consignación",
      pct: null as number | null,
    },
    {
      label: "Costo Mercadería Vendida",
      value: metrics.costoMercaderiaVendida,
      hint: "Costo de los productos vendidos en el período",
      pct: null as number | null,
    },
    {
      label: "Costo Mercadería Comprada",
      value: metrics.totalComprasMercaderia,
      hint: "Costo de los productos comprados en el período",
      pct: null as number | null,
    },
  ];

  const gastosData = metrics.gastosPorCategoria.map((g) => ({
    categoria: g.categoria,
    monto: g.monto,
  }));

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <div className="flex gap-1">
          {PERIODOS.map((p) => (
            <Link
              key={p.key}
              href={`/?periodo=${p.key}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                periodo === (p.key as PeriodoKey)
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-gray-500">{card.label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p
                className={`text-2xl font-semibold ${
                  card.highlight
                    ? card.value >= 0
                      ? "text-green-600"
                      : "text-red-600"
                    : "text-gray-900"
                }`}
              >
                {formatCurrency(card.value)}
              </p>
              {card.pct !== null && (
                <span className={`text-sm font-medium ${card.pct >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {card.pct.toFixed(1)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Ventas sin facturar</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatCurrency(metrics.ventasNoFacturadas.total)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {metrics.ventasNoFacturadas.cantidad} venta
            {metrics.ventasNoFacturadas.cantidad === 1 ? "" : "s"} del período
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Compras sin facturar</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatCurrency(metrics.comprasNoFacturadas.total)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {metrics.comprasNoFacturadas.cantidad} compra
            {metrics.comprasNoFacturadas.cantidad === 1 ? "" : "s"} del período
          </p>
        </div>
      </div>

      {!esRestringido && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-700">
            Gastos por categoría
          </h2>
          <GastosPieChart data={gastosData} />
        </div>
      )}
    </div>
  );
}
