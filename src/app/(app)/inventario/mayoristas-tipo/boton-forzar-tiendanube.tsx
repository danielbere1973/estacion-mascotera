"use client";

import { useState, useTransition } from "react";
import { forzarActualizacionTiendanube } from "./actions";

// Borra la caché de Tiendanube del Catálogo mayorista (ej. después de cargar SKUs en Tiendanube),
// así no hay que esperar los 10 minutos para ver los cambios.
export function BotonForzarTiendanube() {
  const [enviando, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={enviando}
        onClick={() => {
          setMensaje(null);
          startTransition(async () => {
            try {
              await forzarActualizacionTiendanube();
              setMensaje({ ok: true, texto: "Listo: el catálogo mayorista trae los datos de Tiendanube en su próxima carga." });
            } catch (e) {
              setMensaje({ ok: false, texto: e instanceof Error ? e.message : "No se pudo actualizar." });
            }
          });
        }}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {enviando ? "Actualizando..." : "Force update con Tienda Nube"}
      </button>
      {mensaje && (
        <p className={`max-w-xs text-right text-xs ${mensaje.ok ? "text-green-600" : "text-red-600"}`}>{mensaje.texto}</p>
      )}
    </div>
  );
}
