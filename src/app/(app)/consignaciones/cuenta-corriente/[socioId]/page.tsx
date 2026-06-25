import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { generarLiquidacion } from "../../actions";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export default async function CuentaCorrientePage({ params }: { params: Promise<{ socioId: string }> }) {
  const { socioId } = await params;
  const socio = await prisma.socioConsignacion.findUnique({
    where: { id: Number(socioId) },
    include: {
      consignaciones: {
        include: {
          items: {
            include: {
              ventas: { where: { liquidacionId: null }, orderBy: { fecha: "desc" } },
            },
          },
        },
        orderBy: { fecha: "desc" },
      },
      liquidaciones: { orderBy: { fecha: "desc" } },
    },
  });
  if (!socio) notFound();

  // Calcular saldo pendiente (ventas no liquidadas)
  let aCobrarnos = 0;
  let aCobrarles = 0;
  const ventasPendientes: Array<{ fecha: Date; descripcion: string; cantidad: number; precioVentaReal: number; precioCosto: number; montoLiq: number; direction: string }> = [];

  for (const c of socio.consignaciones) {
    for (const item of c.items) {
      const costo = Number(item.precioCosto);
      for (const v of item.ventas) {
        const venta = Number(v.precioVentaReal);
        // El dueño de la mercadería siempre cobra: costo + 1/3 de la ganancia
        // Si vendemos por debajo del costo, el vendedor absorbe la pérdida
        const ganancia = venta - costo;
        const montoLiq = costo + ganancia / 3;
        if (c.direccion === "ENTREGAMOS") aCobrarnos += montoLiq * v.cantidad;
        else aCobrarles += montoLiq * v.cantidad;
        ventasPendientes.push({
          fecha: v.fecha,
          descripcion: item.descripcion ?? `Item #${item.id}`,
          cantidad: v.cantidad,
          precioVentaReal: venta,
          precioCosto: costo,
          montoLiq,
          direction: c.direccion,
        });
      }
    }
  }
  const saldo = aCobrarnos - aCobrarles;
  ventasPendientes.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/consignaciones" className="text-xs text-gray-400 hover:text-gray-600">← Consignaciones</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Cuenta corriente — {socio.nombre}</h1>
      </div>

      {/* Saldo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-400">Nos deben (vendieron los nuestros)</p>
          <p className="text-lg font-semibold text-green-700">{fmt(aCobrarnos)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-400">Les debemos (vendimos los suyos)</p>
          <p className="text-lg font-semibold text-red-600">{fmt(aCobrarles)}</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${saldo > 0 ? "border-green-200 bg-green-50" : saldo < 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
          <p className="text-xs text-gray-400">Saldo neto pendiente</p>
          <p className={`text-lg font-semibold ${saldo > 0 ? "text-green-700" : saldo < 0 ? "text-red-600" : "text-gray-400"}`}>
            {saldo >= 0 ? "" : "-"}{fmt(Math.abs(saldo))}
          </p>
          <p className="text-xs text-gray-400">{saldo > 0 ? "nos deben" : saldo < 0 ? "les debemos" : "en cero"}</p>
        </div>
      </div>

      {/* Ventas pendientes */}
      {ventasPendientes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Movimientos pendientes de liquidar</h2>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {ventasPendientes.map((v, i) => (
              <div key={i} className="flex justify-between items-center px-4 py-2.5 text-sm">
                <div>
                  <span className="text-gray-900">{v.descripcion}</span>
                  <span className="text-gray-400 ml-2 text-xs">{new Date(v.fecha).toLocaleDateString("es-AR")}</span>
                </div>
                <div className="text-right">
                  <span className={`font-medium ${v.direction === "ENTREGAMOS" ? "text-green-700" : "text-red-600"}`}>
                    {v.direction === "ENTREGAMOS" ? "+" : "-"}{fmt(v.montoLiq * v.cantidad)}
                  </span>
                  <span className="text-gray-400 ml-2 text-xs">{v.cantidad} u. · costo {fmt(v.precioCosto)} + 1/3 ganancia</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generar liquidación */}
      {ventasPendientes.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <h2 className="text-sm font-semibold text-blue-900 mb-3">Generar liquidación</h2>
          <form action={generarLiquidacion} className="flex gap-3 items-end flex-wrap">
            <input type="hidden" name="socioId" value={socio.id} />
            <div>
              <label className="text-xs text-blue-700">Desde</label>
              <input name="fechaDesde" type="date" defaultValue={sevenDaysAgo}
                className="block rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-blue-700">Hasta</label>
              <input name="fechaHasta" type="date" defaultValue={today}
                className="block rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-blue-700">Notas</label>
              <input name="notas" placeholder="Opcional"
                className="block w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm" />
            </div>
            <button type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap">
              Generar liquidación
            </button>
          </form>
        </div>
      )}

      {/* Historial de consignaciones */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-700">Consignaciones</h2>
          <Link href="/consignaciones/nueva"
            className="text-xs text-blue-600 hover:underline">+ Nueva</Link>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {socio.consignaciones.map((c) => {
            const totalItems = c.items.reduce((s, it) => s + it.cantidad, 0);
            const totalVendido = c.items.reduce((s, it) => s + it.cantidadVendida, 0);
            return (
              <Link key={c.id} href={`/consignaciones/${c.id}`}
                className="flex justify-between items-center px-4 py-3 hover:bg-gray-50">
                <div>
                  <span className="text-sm text-gray-900">
                    #{c.id} · {c.direccion === "ENTREGAMOS" ? "Entregamos" : "Recibimos"}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{new Date(c.fecha).toLocaleDateString("es-AR")}</span>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {totalVendido}/{totalItems} vendidas
                  <span className={`ml-2 ${c.estado === "ABIERTA" ? "text-green-600" : "text-gray-400"}`}>
                    {c.estado}
                  </span>
                </div>
              </Link>
            );
          })}
          {socio.consignaciones.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Sin consignaciones.</p>
          )}
        </div>
      </div>

      {/* Liquidaciones anteriores */}
      {socio.liquidaciones.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Liquidaciones</h2>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {socio.liquidaciones.map((liq) => (
              <Link key={liq.id} href={`/consignaciones/liquidaciones/${liq.id}`}
                className="flex justify-between items-center px-4 py-3 hover:bg-gray-50">
                <div className="text-sm text-gray-900">
                  #{liq.id} · {new Date(liq.fechaDesde).toLocaleDateString("es-AR")} → {new Date(liq.fechaHasta).toLocaleDateString("es-AR")}
                </div>
                <div className={`text-sm font-semibold ${liq.pagado ? "text-gray-400" : Number(liq.saldo) >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {liq.pagado ? "Pagada" : `Saldo: ${fmt(Number(liq.saldo))}`}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
