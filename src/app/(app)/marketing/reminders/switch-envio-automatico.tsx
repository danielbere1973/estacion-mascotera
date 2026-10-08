"use client";

import { useState, useTransition } from "react";
import { actualizarEnvioAutomatico } from "./actions";

// Switch On/Off del envío automático diario de reminders (cron).
export function SwitchEnvioAutomatico({ activo }: { activo: boolean }) {
  const [pending, startTransition] = useTransition();
  const [on, setOn] = useState(activo);
  // Si cambia desde el server, sincronizar.
  const [activoServer, setActivoServer] = useState(activo);
  if (activo !== activoServer) {
    setActivoServer(activo);
    setOn(activo);
  }

  function cambiar() {
    const nuevo = !on;
    setOn(nuevo);
    startTransition(async () => {
      try {
        await actualizarEnvioAutomatico(nuevo);
      } catch {
        setOn(!nuevo);
        window.alert("No se pudo cambiar el Reminder Automático.");
      }
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
      Reminder Automático
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        onClick={cambiar}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
          on ? "bg-green-600" : "bg-gray-400"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className={`w-7 ${on ? "text-green-700" : "text-gray-500"}`}>{on ? "On" : "Off"}</span>
    </label>
  );
}
