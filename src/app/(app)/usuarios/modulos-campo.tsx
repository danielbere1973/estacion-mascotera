"use client";

import { useEffect, useRef, useState } from "react";
import type { ModuloApp } from "@prisma/client";
import { GRUPOS, MODULOS, normalizarModulos, type GrupoModulo } from "@/lib/modulos";

type Hijo = { modulo: ModuloApp; label: string; icon: string };

// Cada sección va en una fila, una debajo de otra, en el orden del menú.
// Las que tienen submódulos (Marketing, Mayorista) se despliegan con la flecha
// y su casilla tilda o destilda todos los submódulos; las demás muestran la
// flecha igual, pero no despliegan nada.
type Fila = { clave: string; label: string; hijos: Hijo[]; simple?: Hijo };

function armarFilas(): Fila[] {
  const filas: Fila[] = [];
  const vistos = new Set<GrupoModulo>();
  for (const m of MODULOS) {
    if (!m.grupo) {
      filas.push({ clave: m.modulo, label: `${m.icon} ${m.label}`, hijos: [m], simple: m });
    } else if (!vistos.has(m.grupo)) {
      vistos.add(m.grupo);
      const g = m.grupo;
      filas.push({
        clave: g,
        label: `${GRUPOS[g].icon} ${GRUPOS[g].label}`,
        hijos: MODULOS.filter((x) => x.grupo === g),
      });
    }
  }
  return filas;
}

const FILAS = armarFilas();

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

  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="text-sm font-medium text-gray-700">Secciones que puede ver</legend>

      <div className="space-y-1.5">
        {FILAS.map((f) => (
          <FilaModulo key={f.clave} fila={f} marcados={marcados} cambiar={cambiar} />
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

function FilaModulo({
  fila,
  marcados,
  cambiar,
}: {
  fila: Fila;
  marcados: Set<ModuloApp>;
  cambiar: (modulos: ModuloApp[], valor: boolean) => void;
}) {
  const { label, hijos, simple } = fila;
  const [abierta, setAbierta] = useState(false);
  const cantidad = hijos.filter((h) => marcados.has(h.modulo)).length;
  const todos = cantidad === hijos.length;
  const algunos = cantidad > 0 && !todos;
  // Sin submódulos la flecha no despliega nada.
  const alternar = () => !simple && setAbierta((a) => !a);

  // Estado "a medias" de la casilla del grupo cuando hay submódulos sin tildar.
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = algunos;
  }, [algunos]);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2 px-2 py-1">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={simple ? undefined : abierta}
          aria-label={simple ? undefined : abierta ? `Plegar ${label}` : `Desplegar ${label}`}
          tabIndex={simple ? -1 : undefined}
          className={`rounded p-1 ${simple ? "cursor-default text-gray-300" : "text-gray-500 hover:bg-gray-200"}`}
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
            // La casilla de una sección simple es la que se guarda; la de un grupo solo controla a sus hijos.
            name={simple ? "modulos" : undefined}
            value={simple?.modulo}
            checked={todos}
            onChange={(e) => cambiar(hijos.map((h) => h.modulo), e.target.checked)}
            className="h-5 w-5 shrink-0 sm:h-4 sm:w-4"
          />
          {label}
        </label>
        {!simple && (
          <button type="button" onClick={alternar} className="text-xs text-gray-500 hover:text-gray-700">
            {cantidad} de {hijos.length}
          </button>
        )}
      </div>

      {/* Plegada solo se oculta: las casillas siguen en el formulario y se guardan igual. */}
      {!simple && (
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
      )}
    </div>
  );
}
