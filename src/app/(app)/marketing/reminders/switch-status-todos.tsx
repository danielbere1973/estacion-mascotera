"use client";

import { useTransition } from "react";
import type { StatusReminder } from "@prisma/client";
import { actualizarStatusReminderTodos } from "./actions";

// Switch que pone el Status de todas las filas en Activo o Pausado.
// Muestra la acción opuesta al último clic (no cambia con los cambios manuales de Status).
export function SwitchStatusTodos({ ultimoClic }: { ultimoClic: StatusReminder }) {
  const [pending, startTransition] = useTransition();
  const activar = ultimoClic === "PAUSADO";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => actualizarStatusReminderTodos(activar ? "ACTIVO" : "PAUSADO"))}
      className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
        activar ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
      }`}
    >
      {activar ? "Switch to Activo" : "Switch to Pausado"}
    </button>
  );
}
