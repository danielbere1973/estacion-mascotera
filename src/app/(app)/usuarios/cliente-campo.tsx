"use client";

import { useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/combobox";

// "Cliente mayorista vinculado" del usuario: compra en el Catálogo mayorista a nombre de ese
// cliente y en "Mis carritos" ve solo sus pedidos. Vacío = no está vinculado a ningún cliente.
export function ClienteCampo({ clientes, seleccionado }: { clientes: ComboboxOption[]; seleccionado?: number | null }) {
  const [clienteId, setClienteId] = useState(seleccionado ? String(seleccionado) : "");

  return (
    <div className="space-y-1 sm:col-span-2">
      <label className="text-sm font-medium text-gray-700">Cliente mayorista vinculado (opcional)</label>
      <input type="hidden" name="clienteId" value={clienteId} />
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Combobox options={clientes} value={clienteId} onSelect={setClienteId} placeholder="Buscar cliente..." />
        </div>
        {clienteId && (
          <button
            type="button"
            onClick={() => setClienteId("")}
            className="rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            Quitar
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">
        El usuario compra en el Catálogo mayorista a nombre de este cliente y en &quot;Mis carritos&quot; ve solo sus
        pedidos. Si es Solo lectura, igual puede usar el carrito.
      </p>
    </div>
  );
}
