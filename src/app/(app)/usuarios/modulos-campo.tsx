import type { ModuloApp } from "@prisma/client";
import { MODULOS } from "@/lib/modulos";

// Casillas para elegir qué secciones puede ver el usuario (alta y edición).
// En mobile van una debajo de otra y con más alto, fáciles de tocar.
export function ModulosCampo({ seleccionados }: { seleccionados?: ModuloApp[] }) {
  return (
    <fieldset className="space-y-1 sm:col-span-2">
      <legend className="text-sm font-medium text-gray-700">Secciones que puede ver</legend>
      <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((m) => (
          <label key={m.modulo} className="flex items-center gap-2 py-1.5 text-sm text-gray-700 sm:py-0.5">
            <input
              type="checkbox"
              name="modulos"
              value={m.modulo}
              defaultChecked={seleccionados ? seleccionados.includes(m.modulo) : true}
              className="h-5 w-5 shrink-0 sm:h-4 sm:w-4"
            />
            {m.icon} {m.label}
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-400">
        El menú Admin lo ven solo los administradores. El Lector restringido además queda limitado a
        sus secciones fijas (Dashboard, Ventas, Compras, Consignaciones y Logística).
      </p>
    </fieldset>
  );
}
