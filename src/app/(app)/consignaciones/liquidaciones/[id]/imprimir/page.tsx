import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "./print-button";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export default async function ImprimirLiquidacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const liq = await prisma.liquidacionConsignacion.findUnique({
    where: { id: Number(id) },
    include: {
      socio: true,
      ventas: {
        include: { detalle: { include: { consignacion: true } } },
        orderBy: { fecha: "asc" },
      },
      pagos: {
        include: { consignacion: { select: { id: true, direccion: true } } },
        orderBy: { fecha: "asc" },
      },
    },
  });
  if (!liq) notFound();

  const saldo = Number(liq.saldo);
  const totalACobrarnos = Number(liq.totalACobrarnos);
  const totalACobrarles = Number(liq.totalACobrarles);

  const pagosRecibidos = liq.pagos
    .filter((p) => p.consignacion.direccion === "ENTREGAMOS")
    .reduce((s, p) => s + Number(p.monto), 0);
  const pagosRealizados = liq.pagos
    .filter((p) => p.consignacion.direccion === "RECIBIMOS")
    .reduce((s, p) => s + Number(p.monto), 0);

  const pendienteACobrar = totalACobrarnos - pagosRecibidos;
  const pendienteAPagar = totalACobrarles - pagosRealizados;

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 20mm; }
          body { font-size: 12px; }
        }
      `}</style>

      <div className="max-w-2xl mx-auto p-6 space-y-6 text-sm text-gray-800">
        {/* Encabezado */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Estación Mascotera</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Liquidación #{liq.id}</h1>
            <p className="text-gray-600 mt-0.5">{liq.socio.nombre}</p>
            <p className="text-xs text-gray-400 mt-1">
              Período: {new Date(liq.fechaDesde).toLocaleDateString("es-AR")} → {new Date(liq.fechaHasta).toLocaleDateString("es-AR")}
              {" · "}Generada: {new Date(liq.fecha).toLocaleDateString("es-AR")}
            </p>
          </div>
          <PrintButton />
        </div>

        <hr className="border-gray-200" />

        {/* Resumen */}
        <div className="grid grid-cols-2 gap-4">
          {totalACobrarnos > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase">Entregamos → ellos vendieron</p>
              <div className="flex justify-between">
                <span className="text-gray-600">A cobrar</span>
                <span className="font-semibold text-green-700">{fmt(totalACobrarnos)}</span>
              </div>
              {pagosRecibidos > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Pagos recibidos</span>
                  <span className="text-gray-500">− {fmt(pagosRecibidos)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-100 pt-1.5">
                <span className="font-medium">Pendiente</span>
                <span className={`font-bold ${pendienteACobrar > 0 ? "text-green-700" : "text-gray-400"}`}>
                  {pendienteACobrar <= 0 ? "Saldado ✓" : fmt(pendienteACobrar)}
                </span>
              </div>
            </div>
          )}
          {totalACobrarles > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase">Recibimos → nosotros vendimos</p>
              <div className="flex justify-between">
                <span className="text-gray-600">A pagar</span>
                <span className="font-semibold text-red-600">{fmt(totalACobrarles)}</span>
              </div>
              {pagosRealizados > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Pagos realizados</span>
                  <span className="text-gray-500">− {fmt(pagosRealizados)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-100 pt-1.5">
                <span className="font-medium">Pendiente</span>
                <span className={`font-bold ${pendienteAPagar > 0 ? "text-red-600" : "text-gray-400"}`}>
                  {pendienteAPagar <= 0 ? "Saldado ✓" : fmt(pendienteAPagar)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Saldo neto */}
        <div className={`rounded-lg border p-4 text-center ${saldo > 0 ? "border-green-300 bg-green-50" : saldo < 0 ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Saldo neto</p>
          <p className={`text-3xl font-bold mt-1 ${saldo > 0 ? "text-green-700" : saldo < 0 ? "text-red-600" : "text-gray-400"}`}>
            {fmt(Math.abs(saldo))}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {saldo > 0 ? `${liq.socio.nombre} nos debe` : saldo < 0 ? `Nosotros le debemos a ${liq.socio.nombre}` : "En cero"}
          </p>
        </div>

        {liq.notas && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-yellow-800">
            <span className="font-medium">Notas: </span>{liq.notas}
          </div>
        )}

        {/* Detalle de ventas */}
        <div>
          <h2 className="font-semibold text-gray-700 mb-2">Ventas incluidas</h2>
          <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Producto</th>
                <th className="px-3 py-2 text-right">Cant.</th>
                <th className="px-3 py-2 text-right">Precio venta</th>
                <th className="px-3 py-2 text-right">Costo</th>
                <th className="px-3 py-2 text-right">Monto liq.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {liq.ventas.map((v) => {
                const esEntregamos = v.detalle.consignacion.direccion === "ENTREGAMOS";
                const costo = Number(v.detalle.precioCosto);
                const precioVenta = Number(v.precioVentaReal);
                const ganancia = precioVenta - costo;
                const partedueno = costo + ganancia / 3;
                const montoLiq = partedueno * v.cantidad;
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(v.fecha).toLocaleDateString("es-AR")}</td>
                    <td className="px-3 py-2">{v.detalle.descripcion ?? `Item #${v.detalle.id}`}</td>
                    <td className="px-3 py-2 text-right">{v.cantidad}</td>
                    <td className="px-3 py-2 text-right">{fmt(precioVenta)}</td>
                    <td className="px-3 py-2 text-right">{fmt(costo)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${esEntregamos ? "text-green-700" : "text-red-600"}`}>
                      {esEntregamos ? "+" : "-"}{fmt(montoLiq)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detalle de pagos */}
        {liq.pagos.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-700 mb-2">Pagos incluidos</h2>
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Concepto</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {liq.pagos.map((p) => {
                  const esEntregamos = p.consignacion.direccion === "ENTREGAMOS";
                  const quien = esEntregamos
                    ? `${liq.socio.nombre} nos pagó`
                    : `Nosotros le pagamos a ${liq.socio.nombre}`;
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(p.fecha).toLocaleDateString("es-AR")}</td>
                      <td className="px-3 py-2">{quien}{p.notas ? ` · ${p.notas}` : ""}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${esEntregamos ? "text-green-700" : "text-red-600"}`}>
                        {esEntregamos ? "+" : "-"}{fmt(Number(p.monto))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center print:block hidden">
          Estación Mascotera · Liquidación #{liq.id} · {new Date().toLocaleDateString("es-AR")}
        </p>
      </div>
    </>
  );
}
