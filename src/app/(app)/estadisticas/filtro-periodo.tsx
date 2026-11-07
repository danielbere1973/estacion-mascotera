"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function FiltroPeriodo() {
  const router = useRouter();
  const params = useSearchParams();
  const periodo = params.get("periodo") ?? "todo";
  const desde = params.get("desde") ?? "";
  const hasta = params.get("hasta") ?? "";

  function navegar(sp: Record<string, string>) {
    router.push(`/estadisticas?${new URLSearchParams(sp).toString()}`);
  }

  const btn = (p: string, label: string) => (
    <button
      type="button"
      onClick={() => navegar({ periodo: p })}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        periodo === p
          ? "bg-blue-600 text-white"
          : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">Período</label>
        <div className="flex flex-wrap gap-2">
          {btn("todo", "Histórico")}
          {btn("anio", "Este año")}
          {btn("mes", "Este mes")}
          {btn("semana", "Esta semana")}
        </div>
      </div>

      <form
        className="grid w-full grid-cols-2 items-end gap-2 sm:flex sm:w-auto"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const d = fd.get("desde") as string;
          const h = fd.get("hasta") as string;
          if (d && h) navegar({ periodo: "libre", desde: d, hasta: h });
        }}
      >
        <div className="space-y-0.5">
          <label className="block text-xs text-gray-500">Desde</label>
          <input
            name="desde"
            type="date"
            defaultValue={desde}
            className="w-full min-w-36 rounded-md border border-gray-300 px-2 py-1.5 text-sm sm:w-40"
          />
        </div>
        <div className="space-y-0.5">
          <label className="block text-xs text-gray-500">Hasta</label>
          <input
            name="hasta"
            type="date"
            defaultValue={hasta}
            className="w-full min-w-36 rounded-md border border-gray-300 px-2 py-1.5 text-sm sm:w-40"
          />
        </div>
        <button
          type="submit"
          className={`col-span-2 rounded-md px-3 py-2 text-sm font-medium sm:py-1.5 ${
            periodo === "libre"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
          }`}
        >
          Aplicar
        </button>
      </form>
    </div>
  );
}
