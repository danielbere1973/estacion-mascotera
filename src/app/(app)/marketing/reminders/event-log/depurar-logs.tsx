"use client";

import { useState, useTransition } from "react";
import { depurarLogs } from "./actions";

// Borra los eventos de los últimos NN días, previa confirmación.
export function DepurarLogs() {
  const [dias, setDias] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const depurar = () => {
    const n = Number.parseInt(dias, 10);
    if (!Number.isFinite(n) || n < 1) {
      setMensaje("Ingresá la cantidad de días (mínimo 1).");
      return;
    }
    if (!window.confirm(`¿Está seguro de borrar los eventos de los últimos ${n} días?`)) return;
    startTransition(async () => {
      const res = await depurarLogs(n);
      setMensaje(res.error ?? `Se borraron ${res.borrados} eventos.`);
      if (!res.error) setDias("");
    });
  };

  return (
    <div className="space-y-1">
      <label htmlFor="dias-depurar" className="text-sm font-medium text-gray-700">
        Últimos días
      </label>
      <div className="flex items-center gap-2">
        <input
          id="dias-depurar"
          type="number"
          min={1}
          value={dias}
          onChange={(e) => setDias(e.target.value)}
          placeholder="NN"
          className="block w-20 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={depurar}
          disabled={pending}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Depurando…" : "Depura logs"}
        </button>
      </div>
      {mensaje && <p className="text-xs text-gray-500">{mensaje}</p>}
    </div>
  );
}
