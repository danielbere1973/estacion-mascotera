"use client";

import { useState, useTransition } from "react";
import type { PedidoMayorista } from "@/lib/pedidos-mayoristas";
import { PedidoMayoristaItem } from "@/components/pedido-mayorista";
import { misCarritosMayoristas } from "./actions";

// Botón "Mis carritos" (al lado del carrito): abre la lista de pedidos mayoristas del cliente
// vinculado al usuario. Se cargan del servidor al abrir, así siempre están actualizados.
export function BotonMisCarritos() {
  const [abierto, setAbierto] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoMayorista[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, startTransition] = useTransition();

  function abrir() {
    setAbierto(true);
    setError(null);
    startTransition(async () => {
      const r = await misCarritosMayoristas();
      if (r.ok) setPedidos(r.pedidos);
      else setError(r.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="rounded-full border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        title="Ver mis carritos"
      >
        📋 <span className="hidden sm:inline">Mis carritos</span>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAbierto(false)}>
          <div
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="text-lg font-semibold text-gray-900">Mis carritos</h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded px-2 text-gray-400 hover:text-gray-700"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto bg-gray-50 px-5 py-3">
              {cargando && <p className="py-8 text-center text-sm text-gray-400">Cargando...</p>}
              {!cargando && error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {!cargando && !error && pedidos?.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">Todavía no confirmaste ningún carrito.</p>
              )}
              {!cargando && !error && pedidos?.map((p) => <PedidoMayoristaItem key={p.id} pedido={p} />)}
            </div>

            <div className="border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
