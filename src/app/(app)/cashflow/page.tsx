import { FILAS_EGRESO, FILAS_INGRESO, getAniosCashflow, getCashflowAnual } from "@/lib/cashflow";
import { SelectorAnio } from "./selector-anio";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// En la tabla van pesos enteros para que entren los 12 meses.
const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const sumar = (filas: number[][]) => MESES.map((_, i) => filas.reduce((acc, f) => acc + f[i], 0));
const total = (fila: number[]) => fila.reduce((a, b) => a + b, 0);

// Una fila de importes: 12 meses + total. Los meses que todavía no llegaron van vacíos.
function Fila({ label, valores, ultimoMes, clase = "" }: { label: string; valores: number[]; ultimoMes: number; clase?: string }) {
  return (
    <tr className={clase}>
      <td className="sticky left-0 z-10 whitespace-nowrap bg-inherit px-3 py-1.5 text-left">{label}</td>
      {valores.map((v, i) => (
        <td key={i} className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${i > ultimoMes ? "text-gray-300" : ""}`}>
          {i > ultimoMes ? "—" : fmt(v)}
        </td>
      ))}
      <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums">{fmt(total(valores))}</td>
    </tr>
  );
}

export default async function CashflowPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const anios = await getAniosCashflow();
  const pedido = Number((await searchParams).anio);
  const anio = anios.includes(pedido) ? pedido : anios[0];
  const cf = await getCashflowAnual(anio);

  const ingresos = sumar(FILAS_INGRESO.map((f) => cf[f.clave]));
  const egresos = sumar(FILAS_EGRESO.map((f) => cf[f.clave]));
  const neto = MESES.map((_, i) => ingresos[i] - egresos[i]);
  const acumulado = neto.map((_, i) => total(neto.slice(0, i + 1)));

  // En el año en curso, los meses que todavía no llegaron se muestran vacíos.
  const ahora = new Date();
  const ultimoMes = anio === ahora.getUTCFullYear() ? ahora.getUTCMonth() : 11;
  const celda = (valor: number, i: number) => (i > ultimoMes ? "—" : fmt(valor));
  const colorSigno = (n: number) => (n < 0 ? "text-red-600" : "text-gray-900");

  const tarjetas = [
    { label: "Ingresos", valor: total(ingresos), color: "text-green-700" },
    { label: "Egresos", valor: total(egresos), color: "text-red-600" },
    { label: "Resultado del año", valor: total(neto), color: colorSigno(total(neto)) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cashflow</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ingresos y egresos mes a mes (mismo cálculo que Dashboard 2).
          </p>
        </div>
        <SelectorAnio anios={anios} anio={anio} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tarjetas.map((t) => (
          <div key={t.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.label} {anio}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${t.color}`}>{fmt(t.valor)}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left">Concepto</th>
              {MESES.map((m) => (
                <th key={m} className="px-3 py-2 text-right">{m}</th>
              ))}
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white text-gray-700">
            <tr className="bg-green-50 text-xs font-semibold uppercase tracking-wide text-green-800">
              <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5" colSpan={14}>Ingresos</td>
            </tr>
            {FILAS_INGRESO.map((f) => (
              <Fila key={f.clave} label={f.label} valores={cf[f.clave]} ultimoMes={ultimoMes} clase="bg-white" />
            ))}
            <Fila label="Total ingresos" valores={ingresos} ultimoMes={ultimoMes} clase="border-t border-gray-200 bg-white font-semibold text-green-700" />

            <tr className="bg-red-50 text-xs font-semibold uppercase tracking-wide text-red-800">
              <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5" colSpan={14}>Egresos</td>
            </tr>
            {FILAS_EGRESO.map((f) => (
              <Fila key={f.clave} label={f.label} valores={cf[f.clave]} ultimoMes={ultimoMes} clase="bg-white" />
            ))}
            <Fila label="Total egresos" valores={egresos} ultimoMes={ultimoMes} clase="border-t border-gray-200 bg-white font-semibold text-red-600" />

            <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
              <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-left text-gray-900">Resultado del mes</td>
              {neto.map((v, i) => (
                <td key={i} className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${i > ultimoMes ? "text-gray-300" : colorSigno(v)}`}>
                  {celda(v, i)}
                </td>
              ))}
              <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${colorSigno(total(neto))}`}>{fmt(total(neto))}</td>
            </tr>
            <tr className="bg-gray-50 text-gray-600">
              <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 text-left">Saldo acumulado</td>
              {acumulado.map((v, i) => (
                <td key={i} className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${i > ultimoMes ? "text-gray-300" : colorSigno(v)}`}>
                  {celda(v, i)}
                </td>
              ))}
              <td className="px-3 py-1.5" />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Ventas por fecha de venta (con envío cobrado); las ventas internas van en su propia fila. Comisión consignaciones: nuestra parte de lo
        recibido en consignación vendido sin &quot;Nueva venta&quot;. Compras por fecha de compra, con descuento y envío.
      </p>
    </div>
  );
}
