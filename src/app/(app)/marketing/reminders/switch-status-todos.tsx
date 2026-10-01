"use client";

import { useState, useTransition } from "react";
import type { StatusReminder } from "@prisma/client";
import { actualizarStatusReminderTodos } from "./actions";

// Switch que pone el Status de todas las mascotas en Activo o Pausado.
// El texto indica lo que hace el próximo clic: "Todo Activo" activa todo y pasa a "Todo Pausado".
export function SwitchStatusTodos() {
  const [proximo, setProximo] = useState<StatusReminder>("ACTIVO");
  const [pending, startTransition] = useTransition();
  const activar = proximo === "ACTIVO";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(() => actualizarStatusReminderTodos(proximo));
        setProximo(activar ? "PAUSADO" : "ACTIVO");
      }}
      className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
        activar ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
      }`}
    >
      {activar ? "Todo Activo" : "Todo Pausado"}
    </button>
  );
}
