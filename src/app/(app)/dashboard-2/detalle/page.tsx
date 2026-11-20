import Link from "next/link";
import {
  FILAS_EGRESO,
  FILAS_INGRESO,
  getComprasImpagas,
  getMovimientosPeriodo,
  getVentasPendientesCobro,
  type ClaveFila,
  type PagoPendiente,
} from "@/lib/cashflow";
import { formatCurrency, formatDate } from "@/lib/format";
import { aIso, rangoDesdeParams } from "../fechas";

// pagos: solo en las ventas pendientes de cobro, para mostrar la fecha de acreditación de cada pago.
type Fila = { fecha: Date; monto: number; titulo: string; detalle?: string; href?: string; pagos?: PagoPendiente[] };
type Seccion = { titulo: string; filas: Fila[] };

// fechaAcreditacion es una fecha sola guardada a medianoche UTC: se muestra el día tal cual.
const fmtDiaUtc = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

function Acreditaciones({ pagos }: { pagos: PagoPendiente[] }) {
  if (pagos.length === 0) return <span className="text-gray-400">Sin pagos</span>;
  return (
    <ul className="space-y-0.5">
      {pagos.map((p, i) => (
        <li key={i} className="whitespace-nowrap">
          {p.fechaAcreditacion ? (
            <span className={p.acreditado ? "text-gray-700" : "font-medium text-amber-600"}>
              {fmtDiaUtc(p.fechaAcreditacion)}
              {!p.acreditado && " (a acreditar)"}
            </span>
          ) : (
            <span className="font-medium text-amber-600">Sin fecha</span>
          )}
          {pagos.length > 1 && <span className="text-gray-400"> · {formatCurrency(p.monto)}</span>}
        </li>
      ))}
    </ul>
  );
}

const FILAS = [...FILAS_INGRESO, ...FILAS_EGRESO];
const labelDe = (clave: ClaveFila) => FILAS.find((f) => f.clave === clave)!.label;
const esClave = (c: string): c is ClaveFila => FILAS.some((f) => f.clave === c);

// Arma las secciones del listado según el concepto cliqueado en Dashboard 2. Cada una sale de la
// misma función que calcula su cuadro, así el total del detalle coincide con el del dashboard.
async function seccionesDe(
  concepto: string,
  periodo: { desde: Date; hasta: Date },
  proveedorId?: number
): Promise<{ titulo: string; secciones: Seccion[] } | null> {
  const porClave = async (claves: readonly ClaveFila[]) => {
    const movimientos = await getMovimientosPeriodo(periodo);
    return claves.map((clave) => ({ titulo: labelDe(clave), filas: movimientos.filter((m) => m.clave === clave) }));
  };

  if (esClave(concepto)) return { titulo: labelDe(concepto), secciones: await porClave([concepto]) };
  if (concepto === "ingresos") return { titulo: "Total de Ingresos", secciones: await porClave(FILAS_INGRESO.map((f) => f.clave)) };
  if (concepto === "egresos") return { titulo: "Total de Egresos", secciones: await porClave(FILAS_EGRESO.map((f) => f.clave)) };

  if (concepto === "pendientesVentas" || concepto === "pendientesVentasInternas") {
    const internas = concepto === "pendientesVentasInternas";
    const ventas = (await getVentasPendientesCobro(periodo)).filter((v) => v.interna === internas);
    const titulo = internas ? "Ventas internas pendientes de cobro" : "Ventas pendientes de cobro";
    return { titulo, secciones: [{ titulo, filas: ventas }] };
  }

  if (concepto === "comprasImpagas") {
    const compras = await getComprasImpagas(periodo, proveedorId);
    const titulo = proveedorId && compras[0] ? `Compras sin pagar · ${compras[0].proveedor}` : "Compras sin pagar";
    return { titulo, secciones: [{ titulo, filas: compras }] };
  }

  return null;
}

export default async function DetalleDashboard2Page({
  searchParams,
}: {
  searchParams: Promise<{ concepto?: string; desde?: string; hasta?: string; proveedor?: string }>;
}) {
  const params = await searchParams;
  const { desde, hasta, hastaExclusivo } = rangoDesdeParams(params);
  const proveedorId = params.proveedor && /^\d+$/.test(params.proveedor) ? Number(params.proveedor) : undefined;
  const resultado = await seccionesDe(params.concepto ?? "", { desde, hasta: hastaExclusivo }, proveedorId);
  const volver = `/dashboard-2?desde=${aIso(desde)}&hasta=${aIso(hasta)}`;

  if (!resultado) {
    return (
      <div className="space-y-2">
        <Link href={volver} className="text-xs text-gray-400 hover:text-gray-600">← Dashboard 2</Link>
        <p className="text-sm text-gray-500">No se reconoce ese detalle.</p>
      </div>
    );
  }

  const total = resultado.secciones.reduce((acc, s) => acc + s.filas.reduce((a, f) => a + f.monto, 0), 0);
  const cantidad = resultado.secciones.reduce((acc, s) => acc + s.filas.length, 0);
  const variasSecciones = resultado.secciones.length > 1;
  const conAcreditacion = resultado.secciones.some((s) => s.filas.some((f) => f.pagos));
  const columnas = conAcreditacion ? 4 : 3;

  return (
    <div className="space-y-4">
      <div>
        <Link href={volver} className="text-xs text-gray-400 hover:text-gray-600">← Dashboard 2</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">{resultado.titulo}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Del {formatDate(desde)} al {formatDate(hasta)} · {cantidad} movimiento{cantidad !== 1 ? "s" : ""} ·{" "}
          <span className="font-semibold text-gray-900">{formatCurrency(total)}</span>
        </p>
      </div>

      {resultado.secciones.map((s) => {
        const filas = [...s.filas].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
        const subtotal = filas.reduce((a, f) => a + f.monto, 0);
        return (
          <section key={s.titulo} className="space-y-2">
            {variasSecciones && (
              <h2 className="flex justify-between text-sm font-semibold text-gray-700">
                <span>{s.titulo}</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </h2>
            )}
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Concepto</th>
                    {conAcreditacion && <th className="px-3 py-2">Fecha acreditación</th>}
                    <th className="px-3 py-2 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filas.map((f, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-gray-500">{formatDate(f.fecha)}</td>
                      <td className="px-3 py-2">
                        {f.href ? (
                          <Link href={f.href} className="font-medium text-blue-700 hover:underline">{f.titulo}</Link>
                        ) : (
                          <span className="font-medium text-gray-900">{f.titulo}</span>
                        )}
                        {f.detalle && <p className="text-xs text-gray-500">{f.detalle}</p>}
                      </td>
                      {conAcreditacion && (
                        <td className="px-3 py-2 align-top text-xs">
                          <Acreditaciones pagos={f.pagos ?? []} />
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums text-gray-900">
                        {formatCurrency(f.monto)}
                      </td>
                    </tr>
                  ))}
                  {filas.length === 0 && (
                    <tr>
                      <td colSpan={columnas} className="px-3 py-6 text-center text-sm text-gray-400">Sin movimientos en el período.</td>
                    </tr>
                  )}
                </tbody>
                {filas.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                      <td className="px-3 py-2" colSpan={columnas - 1}>Total</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(subtotal)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
