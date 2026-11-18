"use client";

import { useEffect, useRef, useState } from "react";
import type { ModuloApp } from "@prisma/client";
import { GRUPOS, MODULOS, normalizarModulos, type GrupoModulo } from "@/lib/modulos";

// Casillas para elegir qué secciones puede ver el usuario (alta y edición).
// Los módulos con submódulos (Marketing, Mayorista) se muestran como una rama
// desplegable: la casilla del grupo tilda o destilda todos sus submódulos.
// En mobile van una debajo de otra y con más alto, fáciles de tocar.
export function ModulosCampo({ seleccionados }: { seleccionados?: ModuloApp[] }) {
  const [marcados, setMarcados] = useState<Set<ModuloApp>>(
    () => new Set(seleccionados ? normalizarModulos(seleccionados) : MODULOS.map((m) => m.modulo))
  );

  const cambiar = (modulos: ModuloApp[], valor: boolean) =>
    setMarcados((prev) => {
      const nuevo = new Set(prev);
      for (const m of modulos) {
        if (valor) nuevo.add(m);
        else nuevo.delete(m);
      }
      return nuevo;
    });

  const sueltos = MODULOS.filter((m) => !m.grupo);
  const grupos = (Object.keys(GRUPOS) as GrupoModulo[]).map((g) => ({
    grupo: g,
    hijos: MODULOS.filter((m) => m.grupo === g),
  }));

  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="text-sm font-medium text-gray-700">Secciones que puede ver</legend>

      <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {sueltos.map((m) => (
          <Casilla
            key={m.modulo}
            modulo={m.modulo}
            label={`${m.icon} ${m.label}`}
            checked={marcados.has(m.modulo)}
            onChange={(v) => cambiar([m.modulo], v)}
          />
        ))}
      </div>

      <div className="space-y-2">
        {grupos.map(({ grupo, hijos }) => (
          <Rama
            key={grupo}
            label={`${GRUPOS[grupo].icon} ${GRUPOS[grupo].label}`}
            hijos={hijos}
            marcados={marcados}
            cambiar={cambiar}
          />
        ))}
      </div>

      <p className="text-xs text-gray-400">
        El menú Admin lo ven solo los administradores. El Lector restringido además queda limitado a
        sus secciones fijas (Dashboard, Ventas, Compras, Consignaciones y Logística).
      </p>
    </fieldset>
  );
}

function Casilla({
  modulo,
  label,
  checked,
  onChange,
}: {
  modulo: ModuloApp;
  label: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 py-1.5 text-sm text-gray-700 sm:py-0.5">
      <input
        type="checkbox"
        name="modulos"
        value={modulo}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 sm:h-4 sm:w-4"
      />
      {label}
    </label>
  );
}

function Rama({
  label,
  hijos,
  marcados,
  cambiar,
}: {
  label: string;
  hijos: { modulo: ModuloApp; label: string; icon: string }[];
  marcados: Set<ModuloApp>;
  cambiar: (modulos: ModuloApp[], valor: boolean) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const cantidad = hijos.filter((h) => marcados.has(h.modulo)).length;
  const todos = cantidad === hijos.length;
  const algunos = cantidad > 0 && !todos;

  // Estado "a medias" de la casilla del grupo cuando hay submódulos sin tildar.
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = algunos;
  }, [algunos]);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setAbierta((a) => !a)}
          aria-expanded={abierta}
          aria-label={abierta ? `Plegar ${label}` : `Desplegar ${label}`}
          className="rounded p-1 text-gray-500 hover:bg-gray-200"
        >
          <svg
            className={`h-4 w-4 transition-transform ${abierta ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <label className="flex flex-1 items-center gap-2 py-1 text-sm font-medium text-gray-700">
          <input
            ref={ref}
            type="checkbox"
            checked={todos}
            onChange={(e) => cambiar(hijos.map((h) => h.modulo), e.target.checked)}
            className="h-5 w-5 shrink-0 sm:h-4 sm:w-4"
          />
          {label}
        </label>
        <button
          type="button"
          onClick={() => setAbierta((a) => !a)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {cantidad} de {hijos.length}
        </button>
      </div>

      {/* Plegada solo se oculta: las casillas siguen en el formulario y se guardan igual. */}
      <div className={`${abierta ? "" : "hidden"} space-y-0.5 border-t border-gray-200 bg-white py-1.5 pl-11 pr-2`}>
        {hijos.map((h) => (
          <Casilla
            key={h.modulo}
            modulo={h.modulo}
            label={`${h.icon} ${h.label}`}
            checked={marcados.has(h.modulo)}
            onChange={(v) => cambiar([h.modulo], v)}
          />
        ))}
      </div>
    </div>
  );
}
