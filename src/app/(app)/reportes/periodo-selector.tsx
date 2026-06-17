"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function PeriodoSelector() {
  const router = useRouter();
  const params = useSearchParams();
  const periodo = params.get("periodo") ?? "mes";
  const desde = params.get("desde") ?? "";
  const hasta = params.get("hasta") ?? "";

  function navegar(p: string, d?: string, h?: string) {
    const sp = new URLSearchParams({ periodo: p });
    if (d) sp.set("desde", d);
    if (h) sp.set("hasta", h);
    router.push(`/reportes?${sp.toString()}`);
  }

  const btn = (p: string, label: string) => (
    <button
      type="button"
      onClick={() => navegar(p)}
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
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex gap-2">
        {btn("dia", "Hoy")}
        {btn("semana", "Esta semana")}
        {btn("mes", "Este mes")}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          navegar("libre", fd.get("desde") as string, fd.get("hasta") as string);
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
  );
}
