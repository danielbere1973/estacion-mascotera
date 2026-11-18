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
// sufijo "2" = segunda dirección: campos direccion2, altura2, ..., etiquetas con "#2" y todos opcionales.
export function CamposDireccion({
  valores = {},
  inputClassName,
  sufijo = "",
}: {
  valores?: Valores;
  inputClassName: string;
  sufijo?: "" | "2";
}) {
  const n = (campo: string) => `${campo}${sufijo}`;
  const e = sufijo ? `#${sufijo}` : "";
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
        <label className="text-sm font-medium text-gray-700">Dirección (calle){e}</label>
        <input name={n("direccion")} defaultValue={valores.direccion ?? ""} required={!sufijo} className={inputClassName} />
      </div>

      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Altura{e}</label>
          <input name={n("altura")} defaultValue={valores.altura ?? ""} inputMode="numeric" className={inputClassName} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Piso{e}</label>
          <input name={n("piso")} defaultValue={valores.piso ?? ""} className={inputClassName} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Dpto/Unidad{e}</label>
          <input name={n("dpto")} defaultValue={valores.dpto ?? ""} className={inputClassName} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Localidad{e}</label>
        <input
          name={n("localidad")}
          list={n("localidades-ar")}
          defaultValue={valores.localidad ?? ""}
          placeholder="Escribí para buscar..."
          autoComplete="off"
          onChange={(e) => validarLocalidad(e.currentTarget)}
          onBlur={(e) => validarLocalidad(e.currentTarget)}
          className={inputClassName}
        />
        <datalist id={n("localidades-ar")}>
          {localidades.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">CP{e}</label>
        <input name={n("cp")} defaultValue={valores.cp ?? ""} placeholder="Ej: 1406" className={inputClassName} />
      </div>
    </>
  );
}
