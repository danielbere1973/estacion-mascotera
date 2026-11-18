import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { perfilAcceso } from "@/lib/permissions";
import { TipoProductoMayorista } from "@prisma/client";
import { actualizarMargenMayorista } from "./actions";

const LABELS: Record<TipoProductoMayorista, string> = {
  ALIMENTO_SECO: "Alimento seco",
  ALIMENTO_HUMEDO: "Alimento húmedo",
  SNACK: "Snack",
  PIEDRAS: "Piedras",
  ACCESORIOS: "Accesorios",
  OTROS: "Otros",
};

// Valores de arranque sugeridos por Daniel (2026-11-13), editables desde esta pantalla.
const DEFAULTS: Record<TipoProductoMayorista, { margenPorcentaje: number; margenPorcentajeTramo2: number | null; umbralKgTramo2: number | null }> = {
  ALIMENTO_SECO: { margenPorcentaje: 12, margenPorcentajeTramo2: 10, umbralKgTramo2: 7 },
  ALIMENTO_HUMEDO: { margenPorcentaje: 12, margenPorcentajeTramo2: null, umbralKgTramo2: null },
  SNACK: { margenPorcentaje: 15, margenPorcentajeTramo2: null, umbralKgTramo2: null },
  PIEDRAS: { margenPorcentaje: 20, margenPorcentajeTramo2: null, umbralKgTramo2: null },
  ACCESORIOS: { margenPorcentaje: 15, margenPorcentajeTramo2: null, umbralKgTramo2: null },
  OTROS: { margenPorcentaje: 15, margenPorcentajeTramo2: null, umbralKgTramo2: null },
};

export default async function MayoristasMargenesPage() {
  const { soloLectura } = await perfilAcceso(); // Solo lectura: ve los márgenes sin poder cambiarlos.
  const existentes = await prisma.margenMayorista.findMany();
  const porTipo = new Map(existentes.map((m) => [m.tipoProducto, m]));

  const tipos = Object.keys(LABELS) as TipoProductoMayorista[];

  return (
    <div className="space-y-4">
      <div>
        <Link href="/inventario" className="text-xs text-gray-400 hover:text-gray-600">← Inventario</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Márgenes mayoristas</h1>
        <p className="mt-1 text-sm text-gray-500">
          % sobre el costo para calcular el precio mayorista de cada tipo de producto. En alimento seco se puede
          definir un segundo margen para bolsas grandes (igual o mayor al peso indicado).
        </p>
      </div>

      <div className="space-y-3">
        {tipos.map((tipo) => {
          const existente = porTipo.get(tipo);
          const defaults = DEFAULTS[tipo];
          const margenPorcentaje = existente ? Number(existente.margenPorcentaje) : defaults.margenPorcentaje;
          const margenPorcentajeTramo2 = existente
            ? existente.margenPorcentajeTramo2 != null ? Number(existente.margenPorcentajeTramo2) : null
            : defaults.margenPorcentajeTramo2;
          const umbralKgTramo2 = existente
            ? existente.umbralKgTramo2 != null ? Number(existente.umbralKgTramo2) : null
            : defaults.umbralKgTramo2;

          return (
            <form
              key={tipo}
              action={actualizarMargenMayorista}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-3"
            >
              <input type="hidden" name="tipoProducto" value={tipo} />
              <fieldset disabled={soloLectura} className="contents">
              <div className="min-w-[140px]">
                <span className="text-sm font-medium text-gray-800">{LABELS[tipo]}</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Margen %</label>
                <input
                  name="margenPorcentaje"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={margenPorcentaje}
                  required
                  className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>

              {tipo === "ALIMENTO_SECO" && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Margen % (bolsas grandes)</label>
                    <input
                      name="margenPorcentajeTramo2"
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={margenPorcentajeTramo2 ?? ""}
                      className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">A partir de (kg)</label>
                    <input
                      name="umbralKgTramo2"
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={umbralKgTramo2 ?? ""}
                      className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                </>
              )}

              {!soloLectura && (
                <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                  Guardar
                </button>
              )}
              </fieldset>
            </form>
          );
        })}
      </div>
    </div>
  );
}
