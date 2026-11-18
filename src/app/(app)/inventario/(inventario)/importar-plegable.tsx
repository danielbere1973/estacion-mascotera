"use client";

import { useState } from "react";

// En el celular el importador arranca plegado (ocupa media pantalla y casi no se usa desde ahí);
// en desktop se ve siempre abierto, como antes.
export function ImportarPlegable({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-gray-700 md:hidden"
      >
        {titulo}
        <span className="text-gray-400">{abierto ? "▲" : "▼"}</span>
      </button>
      <h2 className="mb-2 hidden text-sm font-medium text-gray-700 md:block">{titulo}</h2>
      <div className={abierto ? "mt-3 md:mt-0" : "hidden md:block"}>{children}</div>
    </div>
  );
}
