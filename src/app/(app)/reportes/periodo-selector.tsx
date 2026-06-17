"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TIPOS_REPORTE = [
  { value: "ventas-resumen", label: "Ventas — Resumen" },
  { value: "ranking-productos", label: "Ventas — Ranking de productos" },
  { value: "por-canal", label: "Ventas — Por canal y medio de pago" },
  { value: "por-vendedor", label: "Ventas — Por vendedor / cobrador" },
  { value: "por-cliente", label: "Ventas — Por cliente" },
  { value: "compras", label: "Compras" },
  { value: "gastos", label: "Gastos" },
  { value: "inventario", label: "Inventario" },
];

export function PeriodoSelector({ tipo }: { tipo: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const periodo = params.get("periodo") ?? "mes";
  const desde = params.get("desde") ?? "";
  const hasta = params.get("hasta") ?? "";

  function navegar(overrides: Record<string, string>) {
    const sp = new URLSearchParams({
      tipo,
      periodo,
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
      ...overrides,
    });
    // limpiar desde/hasta si cambia el periodo a uno predefinido
    if (overrides.periodo && overrides.periodo !== "libre") {
      sp.delete("desde");
      sp.delete("hasta");
    }
    router.push(`/reportes?${sp.toString()}`);
  }

  const btnPeriodo = (p: string, label: string) => (
    <button
      type="button"
      onClick={() => navegar({ periodo: p })}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        periodo === p && !params.get("desde")
          ? "bg-blue-600 text-white"
          : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">Tipo de reporte</label>
        <select
          value={tipo}
          onChange={(e) => navegar({ tipo: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-auto"
        >
          {TIPOS_REPORTE.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {tipo !== "inventario" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Período</label>
            <div className="flex gap-2">
              {btnPeriodo("dia", "Hoy")}
              {btnPeriodo("semana", "Esta semana")}
              {btnPeriodo("mes", "Este mes")}
            </div>
          </div>

          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              navegar({ periodo: "libre", desde: fd.get("desde") as string, hasta: fd.get("hasta") as string });
            }}
          >
            <div className="space-y-0.5">
              <label className="block text-xs text-gray-500">Desde</label>
              <input
                name="desde"
                type="date"
                defaultValue={desde}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-0.5">
              <label className="block text-xs text-gray-500">Hasta</label>
              <input
                name="hasta"
                type="date"
                defaultValue={hasta}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                periodo === "libre"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              Aplicar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
