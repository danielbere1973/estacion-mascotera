import { FILAS_EGRESO, FILAS_INGRESO, getEgresosPendientes, getPendientesCobro, getTotalesPeriodo } from "@/lib/cashflow";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { aIso, hrefDetalle, rangoDesdeParams } from "./fechas";

// Dashboard 2: cuadros de plata que entra y sale en el período. Mismo cálculo que Cashflow
// (lib/cashflow.ts), así los dos coinciden para el mismo año.
type Cuadro = {
  label: string;
  valor: number;
  color: string;
  hint: string;
  pct?: number | null;
  // Cada línea linkea al listado de lo que suma (Dashboard 2 › detalle).
  desglose: { label: string; monto: number; href: string }[];
};

function TarjetaCuadro({ c }: { c: Cuadro }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{c.label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className={`text-2xl font-semibold tabular-nums ${c.color}`}>{formatCurrency(c.valor)}</p>
        {c.pct != null && <span className={`text-sm font-medium ${c.color}`}>{c.pct.toFixed(1)}%</span>}
      </div>
      <p className="mt-1 text-xs text-gray-400">{c.hint}</p>
      {c.desglose.length > 0 && (
        <dl className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs">
          {c.desglose.map((d) => (
            <div key={d.label} className="flex justify-between gap-2">
              <dt>
                <Link href={d.href} className="text-blue-700 hover:underline">{d.label}</Link>
              </dt>
              <dd className="tabular-nums text-gray-700">{formatCurrency(d.monto)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default async function Dashboard2Page({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const params = await searchParams;
  const { desde, hasta, hastaExclusivo } = rangoDesdeParams(params);
  const detalle = (concepto: string, extra?: Record<string, string>) => hrefDetalle(concepto, desde, hasta, extra);
  const [totales, pendientes, egresosPendientes] = await Promise.all([
    getTotalesPeriodo({ desde, hasta: hastaExclusivo }),
    getPendientesCobro({ desde, hasta: hastaExclusivo }),
    getEgresosPendientes({ desde, hasta: hastaExclusivo }),
  ]);
  const totalPendiente = pendientes.ventas.monto + pendientes.ventasInternas.monto;
  const ventasPendientes = pendientes.ventas.ventas + pendientes.ventasInternas.ventas;
  const etiquetaVentas = (n: number) => `${n} venta${n !== 1 ? "s" : ""}`;

  const desgloseIngresos = FILAS_INGRESO.map((f) => ({ label: f.label, monto: totales[f.clave], href: detalle(f.clave) }));
  const desgloseEgresos = FILAS_EGRESO.map((f) => ({ label: f.label, monto: totales[f.clave], href: detalle(f.clave) }));
  const totalIngresos = desgloseIngresos.reduce((acc, d) => acc + d.monto, 0);
  const totalEgresos = desgloseEgresos.reduce((acc, d) => acc + d.monto, 0);
  const rentabilidadNeta = totalIngresos - totalEgresos;
  const pctRentabilidad = totalIngresos > 0 ? (rentabilidadNeta / totalIngresos) * 100 : null;

  const cuadros: Cuadro[] = [
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
        { label: "Total de Ingresos", monto: totalIngresos, href: detalle("ingresos") },
        { label: "Total de Egresos", monto: -totalEgresos, href: detalle("egresos") },
      ],
    },
  ];

  // Segunda línea: lo que falta cobrar (izquierda) y lo que falta pagar (derecha).
  const cuadrosPendientes: Cuadro[] = [
    {
      label: "Ingresos pendientes de cobro",
      valor: totalPendiente,
      color: "text-amber-600",
      hint: `${etiquetaVentas(ventasPendientes)} del período sin cobrar del todo (total − pagos registrados)`,
      desglose: [
        { label: `Ventas (${etiquetaVentas(pendientes.ventas.ventas)})`, monto: pendientes.ventas.monto, href: detalle("pendientesVentas") },
        { label: `Ventas internas (${etiquetaVentas(pendientes.ventasInternas.ventas)})`, monto: pendientes.ventasInternas.monto, href: detalle("pendientesVentasInternas") },
      ],
    },
    {
      label: "Egresos pendientes de pago",
      valor: egresosPendientes.monto,
      color: "text-amber-600",
      hint: `${egresosPendientes.compras} compra${egresosPendientes.compras !== 1 ? "s" : ""} de mercadería del período sin marcar como pagada`,
      desglose: egresosPendientes.porProveedor.map((p) => ({
        label: `${p.proveedor} (${p.compras} compra${p.compras !== 1 ? "s" : ""})`,
        monto: p.monto,
        href: detalle("comprasImpagas", { proveedor: String(p.proveedorId) }),
      })),
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cuadros.map((c) => (
          <TarjetaCuadro key={c.label} c={c} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cuadrosPendientes.map((c) => (
          <TarjetaCuadro key={c.label} c={c} />
        ))}
      </div>
    </div>
  );
}
