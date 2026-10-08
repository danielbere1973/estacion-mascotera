"use client";

import { useState, useTransition } from "react";
import { enviarReminders } from "./actions";

// Envía el mail de reminder a los clientes con Status Activo y más días desde la última compra que su Setup reminder.
export function EnviarReminders({ cantidad, sinEmail }: { cantidad: number; sinEmail: number }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const enviar = () => {
    if (cantidad === 0) {
      setMensaje("No hay clientes que cumplan las condiciones (Activo, días transcurridos mayores al Setup reminder y sin reminder enviado en los últimos 30 días).");
      return;
    }
    const aviso = sinEmail > 0 ? `\n(${sinEmail} clientes más cumplen las condiciones pero no tienen email.)` : "";
    if (!window.confirm(`¿Enviar el mail de reminder a ${cantidad} clientes, uno por uno?${aviso}`)) return;
    startTransition(async () => {
      const r = await enviarReminders();
      setMensaje(
        `Enviados: ${r.enviados}` +
          (r.errores ? ` · Con error: ${r.errores}` : "") +
          (r.sinEmail ? ` · Sin email: ${r.sinEmail}` : "") +
          ". Detalle en el Event log.",
      );
    });
  };

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={enviar}
        disabled={pending}
        title="Status Activo, días transcurridos mayores al Setup reminder y sin reminder enviado en los últimos 30 días"
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Enviando…" : `Enviar reminders (${cantidad})`}
      </button>
      {mensaje && <p className="mt-1 text-xs text-gray-500">{mensaje}</p>}
    </div>
  );
}
