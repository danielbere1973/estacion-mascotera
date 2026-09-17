"use client";

import { useState } from "react";
import type { FilaCambioHym, FilaSinResolver } from "@/lib/hym-precios";
import type { SincronizacionHym } from "@prisma/client";

function formatMoney(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${n.toLocaleString("es-AR")}`;
}

function formatFecha(fecha: Date) {
  return new Date(fecha).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Resumen = {
  totalFilasCsv: number;
  soloPrecios: number;
  precioYPromo: number;
  sinStock: number;
  pocoStock: number;
  stockDisponible: number;
  sinSkuInterno: number;
  sinVarianteTN: number;
  sinCambioReal: number;
};

type ErrorAplicado = { sku: string; status: number; detalle: string };

export function DetalleCorrida({ corrida }: { corrida: SincronizacionHym }) {
  const [abierto, setAbierto] = useState(false);

  const resumen = corrida.resumenJson as unknown as Resumen;
  const cambios = corrida.cambiosJson as unknown as FilaCambioHym[];
  const errores = corrida.erroresJson as unknown as ErrorAplicado[];
  const erroresPorSku = new Map(errores.map((e) => [e.sku, e]));
  const sinResolver = (corrida.sinResolverJson as unknown as FilaSinResolver[] | null) ?? [];

  const huboProblema = corrida.erroresCount > 0 || !corrida.excelActualizado;

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-gray-800">{formatFecha(corrida.fecha)}</p>
          <p className="text-xs text-gray-500">
            {corrida.exitosos} cambios aplicados
            {corrida.erroresCount > 0 && `, ${corrida.erroresCount} errores`} · {corrida.totalFilasCsv} filas en el CSV
          </p>
        </div>
        <div className="flex items-center gap-2">
          {huboProblema && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Revisar</span>
          )}
          <span className="text-gray-400">{abierto ? "▲" : "▼"}</span>
        </div>
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-gray-100 px-4 py-3">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 sm:grid-cols-4">
            <p>Solo precio: <span className="font-semibold">{resumen.soloPrecios}</span></p>
            <p>Precio + promo: <span className="font-semibold">{resumen.precioYPromo}</span></p>
            <p>Sin Stock (vaciados): <span className="font-semibold text-red-600">{resumen.sinStock}</span></p>
            <p>Poco Stock: <span className="font-semibold">{resumen.pocoStock}</span></p>
            <p>Stock disponible: <span className="font-semibold">{resumen.stockDisponible}</span></p>
            <p>Sin SKU interno: <span className="font-semibold">{resumen.sinSkuInterno}</span></p>
            <p>Sin variante en TN: <span className="font-semibold">{resumen.sinVarianteTN}</span></p>
            <p>Excel actualizado: <span className="font-semibold">{corrida.excelActualizado ? "Sí" : "No"}</span></p>
          </div>

          {cambios.length === 0 ? (
            <p className="text-sm text-gray-500">No hubo cambios reales para aplicar en esta corrida.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-left uppercase text-gray-500">
                  <tr>
                    <th className="px-2 py-2">SKU HYM</th>
                    <th className="px-2 py-2">SKU Interno</th>
                    <th className="px-2 py-2">Nombre TN</th>
                    <th className="px-2 py-2">Estado HYM</th>
                    <th className="px-2 py-2 text-right">Precio actual</th>
                    <th className="px-2 py-2 text-right">Precio nuevo</th>
                    <th className="px-2 py-2 text-right">Promo nueva</th>
                    <th className="px-2 py-2 text-right">Stock actual</th>
                    <th className="px-2 py-2 text-right">Stock nuevo</th>
                    <th className="px-2 py-2">Acción</th>
                    <th className="px-2 py-2">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cambios.map((f) => {
                    const error = erroresPorSku.get(f.skuHym);
                    return (
                      <tr key={f.skuHym} className={error ? "bg-red-50" : ""}>
                        <td className="px-2 py-1.5 font-mono">{f.skuHym}</td>
                        <td className="px-2 py-1.5 font-mono">{f.skuInterno}</td>
                        <td className="px-2 py-1.5">{f.nombreTN}</td>
                        <td className="px-2 py-1.5">{f.estadoStockHym}</td>
                        <td className="px-2 py-1.5 text-right">{formatMoney(f.tnPrecioActual)}</td>
                        <td className="px-2 py-1.5 text-right font-medium">{formatMoney(f.nuevoPrecio)}</td>
                        <td className="px-2 py-1.5 text-right">
                          {f.nuevoPromocional === undefined ? "—" : formatMoney(f.nuevoPromocional)}
                        </td>
                        <td className="px-2 py-1.5 text-right">{f.tnStockActual ?? "—"}</td>
                        <td className="px-2 py-1.5 text-right">{f.nuevoStock ?? "—"}</td>
                        <td className="px-2 py-1.5">{f.accion}</td>
                        <td className="px-2 py-1.5">
                          {error ? (
                            <span className="text-red-600">
                              {error.status} {error.detalle}
                            </span>
                          ) : (
                            <span className="text-green-600">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {sinResolver.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-600">
                Sin resolver ({sinResolver.length}):
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-left uppercase text-gray-500">
                    <tr>
                      <th className="px-2 py-2">SKU HYM</th>
                      <th className="px-2 py-2">Nombre HYM</th>
                      <th className="px-2 py-2">SKU Interno</th>
                      <th className="px-2 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sinResolver.map((f, i) => (
                      <tr key={`${f.skuHym}-${i}`}>
                        <td className="px-2 py-1.5 font-mono">{f.skuHym}</td>
                        <td className="px-2 py-1.5">{f.nombreHym}</td>
                        <td className="px-2 py-1.5 font-mono">{f.skuInterno ?? "—"}</td>
                        <td className="px-2 py-1.5 text-gray-500">{f.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
