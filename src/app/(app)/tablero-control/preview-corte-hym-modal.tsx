"use client";

import { useState } from "react";
import { forzarCorteCompraHym } from "./actions";

interface ItemPreview {
  lineaId: number;
  skuInterno: string;
  nombre: string;
  cantidad: number;
}

export function PreviewCorteHymModal({
  conMapeo,
  sinMapeo,
  onClose,
  onConfirmado,
}: {
  conMapeo: ItemPreview[];
  sinMapeo: ItemPreview[];
  onClose: () => void;
  onConfirmado: (resultado: { ok: true; items: number } | { ok: false; error: string }) => void;
}) {
  const [excluidos, setExcluidos] = useState<Set<number>>(new Set());
  const [confirmando, setConfirmando] = useState(false);

  function toggleExcluido(lineaId: number) {
    setExcluidos((prev) => {
      const next = new Set(prev);
      if (next.has(lineaId)) next.delete(lineaId);
      else next.add(lineaId);
      return next;
    });
  }

  async function handleConfirmar() {
    setConfirmando(true);
    try {
      const resultado = await forzarCorteCompraHym([...excluidos]);
      onConfirmado(resultado.ok ? { ok: true, items: resultado.items } : resultado);
    } finally {
      setConfirmando(false);
    }
  }

  const cantidadAPedir = conMapeo.length - excluidos.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Confirmar corte de compra HYM</h2>

        {conMapeo.length === 0 && sinMapeo.length === 0 && (
          <p className="text-sm text-gray-500">No hay pendientes de HYM en este momento.</p>
        )}

        {conMapeo.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">Se pedirían a HYM:</p>
            <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-100">
                  {conMapeo.map((item) => {
                    const excluido = excluidos.has(item.lineaId);
                    return (
                      <tr key={item.lineaId} className={excluido ? "opacity-40" : ""}>
                        <td className="w-8 px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={!excluido}
                            onChange={() => toggleExcluido(item.lineaId)}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-gray-700">
                          {item.nombre}
                          <span className="ml-1 font-mono text-gray-400">SKU {item.skuInterno}</span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-gray-700">
                          x{item.cantidad}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">Destildá los que no querés pedir en este corte.</p>
          </div>
        )}

        {sinMapeo.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-sm font-medium text-amber-700">
              ⚠️ Sin mapeo HYM — gestionar en otro lado:
            </p>
            <div className="rounded-md border border-amber-200 bg-amber-50">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-amber-100">
                  {sinMapeo.map((item) => (
                    <tr key={item.lineaId}>
                      <td className="px-2 py-1.5 text-amber-800">
                        {item.nombre}
                        <span className="ml-1 font-mono text-amber-500">SKU {item.skuInterno}</span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-amber-800">
                        x{item.cantidad}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={confirmando || cantidadAPedir === 0}
            onClick={handleConfirmar}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmando ? "Confirmando..." : `Confirmar pedido (${cantidadAPedir})`}
          </button>
        </div>
      </div>
    </div>
  );
}
