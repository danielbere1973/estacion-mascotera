"use client";

import { useMemo, useState } from "react";
import { aplicarLoteHym } from "./actions";
import type { FilaCambioHym, ResultadoCalculoHym } from "@/lib/hym-precios";

const TAMANIO_LOTE = 15;

function formatMoney(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${n.toLocaleString("es-AR")}`;
}

type EstadoAplicacion = {
  enCurso: boolean;
  procesados: number;
  total: number;
  exitosos: string[];
  errores: { sku: string; status: number; detalle: string }[];
  terminado: boolean;
};

type FiltroStat =
  | "soloPrecios"
  | "precioYPromo"
  | "sinStock"
  | "pocoStock"
  | "stockDisponible"
  | "sinSkuInterno"
  | "sinVarianteTN";

function categoriaDeFila(f: FilaCambioHym): FiltroStat | null {
  if (f.esVaciarPorSinStock) return "sinStock";
  if (f.nuevoStock === 5) return "pocoStock";
  if (f.nuevoStock === 10) return "stockDisponible";
  if (f.nuevoPromocional !== undefined) return "precioYPromo";
  return "soloPrecios";
}

const MOTIVO_SIN_SKU_INTERNO = "SIN SKU INTERNO - no está en el Excel de mapeo HYM";
const MOTIVO_SIN_VARIANTE_TN = "SIN VARIANTE EN TIENDANUBE - no es de este proveedor o falta cargar SKU";

export function TablaCambiosHym({ resultado }: { resultado: ResultadoCalculoHym }) {
  const [excluidas, setExcluidas] = useState<Set<string>>(new Set());
  const [aplicacion, setAplicacion] = useState<EstadoAplicacion | null>(null);
  const [filtro, setFiltro] = useState<FiltroStat | null>(null);
  const [soloConCambioPrecio, setSoloConCambioPrecio] = useState(false);
  const [soloConCambioStock, setSoloConCambioStock] = useState(false);

  const filasAAplicar = useMemo(
    () => resultado.cambios.filter((f) => !f.sinCambioReal && !excluidas.has(f.skuHym)),
    [resultado.cambios, excluidas],
  );

  const esFiltroSinResolver = filtro === "sinSkuInterno" || filtro === "sinVarianteTN";

  const filasMostradas = useMemo(() => {
    let filas = filtro && !esFiltroSinResolver ? resultado.cambios.filter((f) => categoriaDeFila(f) === filtro) : resultado.cambios;
    if (soloConCambioPrecio) filas = filas.filter((f) => f.cambiaPrecio || f.cambiaPromo);
    if (soloConCambioStock) filas = filas.filter((f) => f.cambiaStock);
    return filas;
  }, [resultado.cambios, filtro, esFiltroSinResolver, soloConCambioPrecio, soloConCambioStock]);

  const sinResolverMostrados = useMemo(() => {
    if (filtro === "sinSkuInterno") return resultado.sinResolver.filter((f) => f.motivo === MOTIVO_SIN_SKU_INTERNO);
    if (filtro === "sinVarianteTN") return resultado.sinResolver.filter((f) => f.motivo === MOTIVO_SIN_VARIANTE_TN);
    return resultado.sinResolver;
  }, [resultado.sinResolver, filtro]);

  function toggleFiltro(cat: FiltroStat) {
    setFiltro((prev) => (prev === cat ? null : cat));
  }

  function toggleExcluida(sku: string) {
    setExcluidas((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  async function aplicar() {
    const total = filasAAplicar.length;
    if (total === 0) return;

    setAplicacion({ enCurso: true, procesados: 0, total, exitosos: [], errores: [], terminado: false });

    const exitosos: string[] = [];
    const errores: { sku: string; status: number; detalle: string }[] = [];

    for (let i = 0; i < total; i += TAMANIO_LOTE) {
      const lote = filasAAplicar.slice(i, i + TAMANIO_LOTE);
      try {
        const res = await aplicarLoteHym(lote);
        exitosos.push(...res.exitosos);
        errores.push(...res.errores);
      } catch (e) {
        for (const f of lote) {
          errores.push({ sku: f.skuHym, status: 0, detalle: e instanceof Error ? e.message : "Error desconocido" });
        }
      }

      setAplicacion({
        enCurso: true,
        procesados: Math.min(i + lote.length, total),
        total,
        exitosos: [...exitosos],
        errores: [...errores],
        terminado: false,
      });
    }

    setAplicacion({ enCurso: false, procesados: total, total, exitosos, errores, terminado: true });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 sm:grid-cols-4">
        <p>Filas en CSV: <span className="font-semibold">{resultado.resumen.totalFilasCsv}</span></p>
        <StatFiltro label="Solo precio" valor={resultado.resumen.soloPrecios} cat="soloPrecios" filtro={filtro} onClick={toggleFiltro} />
        <StatFiltro label="Precio + promo" valor={resultado.resumen.precioYPromo} cat="precioYPromo" filtro={filtro} onClick={toggleFiltro} />
        <StatFiltro
          label="Sin Stock (vaciar)"
          valor={resultado.resumen.sinStock}
          cat="sinStock"
          filtro={filtro}
          onClick={toggleFiltro}
          claseValor="text-red-600"
        />
        <StatFiltro label="Poco Stock" valor={resultado.resumen.pocoStock} cat="pocoStock" filtro={filtro} onClick={toggleFiltro} />
        <StatFiltro label="Stock disponible" valor={resultado.resumen.stockDisponible} cat="stockDisponible" filtro={filtro} onClick={toggleFiltro} />
        <StatFiltro label="Sin SKU interno" valor={resultado.resumen.sinSkuInterno} cat="sinSkuInterno" filtro={filtro} onClick={toggleFiltro} />
        <StatFiltro label="Sin variante en TN" valor={resultado.resumen.sinVarianteTN} cat="sinVarianteTN" filtro={filtro} onClick={toggleFiltro} />
        <p>Sin cambio real (no se tocan): <span className="font-semibold text-gray-500">{resultado.resumen.sinCambioReal}</span></p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSoloConCambioPrecio((v) => !v)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ring-1 ${
            soloConCambioPrecio ? "bg-blue-100 text-blue-700 ring-blue-400" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
          }`}
        >
          Solo con cambio de precio
        </button>
        <button
          onClick={() => setSoloConCambioStock((v) => !v)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ring-1 ${
            soloConCambioStock ? "bg-blue-100 text-blue-700 ring-blue-400" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
          }`}
        >
          Solo con cambio de stock
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {filasAAplicar.length} de {resultado.cambios.length} cambios se van a aplicar
          {excluidas.size > 0 && ` (${excluidas.size} excluidos manualmente)`}.
          {filtro && (
            <>
              {" "}Mostrando solo{" "}
              <span className="font-semibold">
                {esFiltroSinResolver ? sinResolverMostrados.length : filasMostradas.length}
              </span>{" "}
              filas filtradas
              {esFiltroSinResolver && " (ver detalle \"sin resolver\" más abajo)"}
              {" "}
              <button onClick={() => setFiltro(null)} className="text-blue-600 underline hover:no-underline">
                (quitar filtro)
              </button>
              .
            </>
          )}
        </p>
        <button
          onClick={aplicar}
          disabled={!!aplicacion?.enCurso || filasAAplicar.length === 0}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {aplicacion?.enCurso ? `Aplicando... (${aplicacion.procesados}/${aplicacion.total})` : "Confirmar y aplicar en Tiendanube"}
        </button>
      </div>

      {aplicacion && (
        <div className="rounded-lg border border-gray-200 p-3 text-sm">
          {aplicacion.enCurso && (
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${(aplicacion.procesados / aplicacion.total) * 100}%` }}
              />
            </div>
          )}
          {aplicacion.terminado && (
            <div>
              <p className="font-medium text-gray-800">
                Terminado: {aplicacion.exitosos.length} exitosos, {aplicacion.errores.length} errores.
              </p>
              {aplicacion.errores.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-red-600">
                  {aplicacion.errores.map((e, i) => (
                    <li key={i}>
                      {e.sku}: {e.status} {e.detalle}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {esFiltroSinResolver ? (
        <p className="text-sm text-gray-500">
          Estos productos no tienen cambios para aplicar — no se pudieron cruzar con Tiendanube. Ver el detalle
          &quot;sin resolver&quot; más abajo.
        </p>
      ) : (
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left uppercase text-gray-500">
            <tr>
              <th className="px-2 py-2 w-8"></th>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filasMostradas.map((f) => (
              <FilaTabla
                key={f.skuHym}
                fila={f}
                excluida={excluidas.has(f.skuHym)}
                onToggle={() => toggleExcluida(f.skuHym)}
              />
            ))}
          </tbody>
        </table>
      </div>
      )}

      {resultado.sinResolver.length > 0 && (
        <details open={esFiltroSinResolver} className="rounded-lg border border-gray-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-gray-700">
            {esFiltroSinResolver ? sinResolverMostrados.length : resultado.sinResolver.length} sin resolver (no se
            van a tocar)
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-gray-500">
            {sinResolverMostrados.map((f, i) => (
              <li key={i}>
                {f.skuHym} — {f.nombreHym} — {f.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}

      {resultado.excluidos.length > 0 && (
        <details className="rounded-lg border border-gray-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-gray-700">
            {resultado.excluidos.length} excluidos por regla fija (SKU con mapeo conocido-erróneo)
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-gray-500">
            {resultado.excluidos.map((f, i) => (
              <li key={i}>
                {f.skuHym} — {f.nombreHym}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function StatFiltro({
  label,
  valor,
  cat,
  filtro,
  onClick,
  claseValor,
}: {
  label: string;
  valor: number;
  cat: FiltroStat;
  filtro: FiltroStat | null;
  onClick: (cat: FiltroStat) => void;
  claseValor?: string;
}) {
  const activo = filtro === cat;
  return (
    <button
      onClick={() => onClick(cat)}
      className={`rounded px-1 py-0.5 text-left transition-colors ${
        activo ? "bg-blue-100 ring-1 ring-blue-400" : "hover:bg-gray-100"
      }`}
    >
      {label}: <span className={`font-semibold ${claseValor ?? ""}`}>{valor}</span>
    </button>
  );
}

function FilaTabla({
  fila,
  excluida,
  onToggle,
}: {
  fila: FilaCambioHym;
  excluida: boolean;
  onToggle: () => void;
}) {
  const resaltada = fila.esVaciarPorSinStock;
  const sinCambio = fila.sinCambioReal;
  const claseFila = sinCambio
    ? "bg-gray-50 text-gray-400"
    : resaltada
      ? (excluida ? "bg-gray-50 text-gray-400" : "bg-red-50")
      : (excluida ? "bg-gray-50 text-gray-400" : "");

  return (
    <tr className={claseFila}>
      <td className="px-2 py-1.5">
        {!sinCambio && (
          <input type="checkbox" checked={!excluida} onChange={onToggle} className="h-3.5 w-3.5" />
        )}
      </td>
      <td className="px-2 py-1.5 font-mono">{fila.skuHym}</td>
      <td className="px-2 py-1.5 font-mono">{fila.skuInterno}</td>
      <td className="px-2 py-1.5">{fila.nombreTN}</td>
      <td className="px-2 py-1.5">{fila.estadoStockHym}</td>
      <td className="px-2 py-1.5 text-right">{formatMoney(fila.tnPrecioActual)}</td>
      <td className="px-2 py-1.5 text-right font-medium">{formatMoney(fila.nuevoPrecio)}</td>
      <td className="px-2 py-1.5 text-right">
        {fila.nuevoPromocional === undefined ? "—" : formatMoney(fila.nuevoPromocional)}
      </td>
      <td className="px-2 py-1.5 text-right">{fila.tnStockActual ?? "—"}</td>
      <td className="px-2 py-1.5 text-right">{fila.nuevoStock ?? "—"}</td>
      <td className="px-2 py-1.5">{fila.accion}</td>
    </tr>
  );
}
