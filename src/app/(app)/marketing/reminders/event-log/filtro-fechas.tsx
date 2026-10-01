"use client";

import { DepurarLogs } from "./depurar-logs";

// Filtro Desde/Hasta del Event log. Al hacer clic en el campo se abre el calendario.
export function FiltroFechas({ desde, hasta }: { desde: string; hasta: string }) {
  const abrirCalendario = (e: React.MouseEvent<HTMLInputElement>) => {
    try {
      e.currentTarget.showPicker();
    } catch {
      // Navegadores sin showPicker: el campo abre su calendario por su cuenta.
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="desde" className="text-sm font-medium text-gray-700">
            Desde
          </label>
          <input
            id="desde"
            type="date"
            name="desde"
            defaultValue={desde}
            max={hasta || undefined}
            onClick={abrirCalendario}
            className="block w-44 cursor-pointer rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="hasta" className="text-sm font-medium text-gray-700">
            Hasta
          </label>
          <input
            id="hasta"
            type="date"
            name="hasta"
            defaultValue={hasta}
            min={desde || undefined}
            onClick={abrirCalendario}
            className="block w-44 cursor-pointer rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Filtrar
        </button>
        <a
          href="/marketing/reminders/event-log"
          className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
        >
          Limpiar
        </a>
      </form>
      <div className="ml-auto">
        <DepurarLogs />
      </div>
    </div>
  );
}
