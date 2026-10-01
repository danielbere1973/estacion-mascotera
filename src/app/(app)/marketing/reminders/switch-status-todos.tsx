"use client";

import { useTransition } from "react";
import { actualizarStatusReminderTodos } from "./actions";

// Switch que pone el Status de todas las mascotas en Activo o Pausado.
// Si ya están todas activas ofrece "Switch to Pausado"; si hay alguna pausada, "Switch to Activo".
export function SwitchStatusTodos({ todosActivos }: { todosActivos: boolean }) {
  const [pending, startTransition] = useTransition();
  const activar = !todosActivos;

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
