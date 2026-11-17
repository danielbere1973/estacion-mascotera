"use client";

import { useTransition } from "react";
import { actualizarTipoProductoMayorista } from "./actions";

const OPCIONES = [
  { value: "", label: "— Sin asignar —" },
  { value: "ALIMENTO_SECO", label: "Alimento seco" },
  { value: "ALIMENTO_HUMEDO", label: "Alimento húmedo" },
  { value: "SNACK", label: "Snack" },
  { value: "PIEDRAS", label: "Piedras" },
  { value: "ACCESORIOS", label: "Accesorios" },
  { value: "OTROS", label: "Otros" },
];

export function TipoMayoristaSelect({ productoId, value }: { productoId: number; value: string }) {
  const [isPending, startTransition] = useTransition();

  function onChange(nuevoValor: string) {
    const formData = new FormData();
    formData.set("id", String(productoId));
    formData.set("tipoProductoMayorista", nuevoValor);
    startTransition(() => {
      actualizarTipoProductoMayorista(formData);
    });
  }

  return (
    <select
      defaultValue={value}
      disabled={isPending}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-50"
    >
      {OPCIONES.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
