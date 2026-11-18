"use client";

import { useEffect, useState } from "react";

// Localidades de Argentina ("Localidad, Provincia"), de la API Georef de datos.gob.ar.
// Se bajan una sola vez por pestaña desde /public.
let cacheLocalidades: Promise<string[]> | null = null;
function cargarLocalidades() {
  cacheLocalidades ??= fetch("/localidades-ar.json")
    .then((r) => r.json() as Promise<string[]>)
    .catch(() => {
      cacheLocalidades = null;
      return [];
    });
  return cacheLocalidades;
}

type Valores = {
  direccion?: string;
  altura?: string | null;
  piso?: string | null;
  dpto?: string | null;
  localidad?: string | null;
  cp?: string | null;
};

// Campos de dirección del alta y la edición de cliente: Dirección (calle), Altura, Piso, Dpto, Localidad y CP.
export function CamposDireccion({ valores = {}, inputClassName }: { valores?: Valores; inputClassName: string }) {
  const [localidades, setLocalidades] = useState<string[]>([]);

  useEffect(() => {
    cargarLocalidades().then(setLocalidades);
  }, []);

  // La localidad tiene que ser una de la lista (o quedar vacía).
  function validarLocalidad(input: HTMLInputElement) {
    const v = input.value.trim();
    const valida = !v || localidades.length === 0 || localidades.includes(v);
    input.setCustomValidity(valida ? "" : "Elegí una localidad de la lista.");
  }

  return (
    <>
      <div className="space-y-1 sm:col-span-2">
        <label className="text-sm font-medium text-gray-700">Dirección (calle)</label>
        <input name="direccion" defaultValue={valores.direccion ?? ""} required className={inputClassName} />
      </div>

      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Altura</label>
          <input name="altura" defaultValue={valores.altura ?? ""} inputMode="numeric" className={inputClassName} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Piso</label>
          <input name="piso" defaultValue={valores.piso ?? ""} className={inputClassName} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Dpto</label>
          <input name="dpto" defaultValue={valores.dpto ?? ""} className={inputClassName} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Localidad</label>
        <input
          name="localidad"
          list="localidades-ar"
          defaultValue={valores.localidad ?? ""}
          placeholder="Escribí para buscar..."
          autoComplete="off"
          onChange={(e) => validarLocalidad(e.currentTarget)}
          onBlur={(e) => validarLocalidad(e.currentTarget)}
          className={inputClassName}
        />
        <datalist id="localidades-ar">
          {localidades.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">CP</label>
        <input name="cp" defaultValue={valores.cp ?? ""} placeholder="Ej: 1406" className={inputClassName} />
      </div>
    </>
  );
}
