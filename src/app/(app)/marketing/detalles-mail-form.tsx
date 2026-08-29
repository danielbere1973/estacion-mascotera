"use client";

import type { RefObject } from "react";

export function DetallesMailForm({
  tituloRef,
  remitenteRef,
  cuerpoRef,
}: {
  tituloRef: RefObject<HTMLInputElement | null>;
  remitenteRef: RefObject<HTMLInputElement | null>;
  cuerpoRef: RefObject<HTMLDivElement | null>;
}) {
  function borrarCampania() {
    if (tituloRef.current) tituloRef.current.value = "";
    if (remitenteRef.current) remitenteRef.current.value = "";
    if (cuerpoRef.current) cuerpoRef.current.innerHTML = "";
  }

  return (
    <div className="flex flex-1 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Detalles del mail</p>
        <button
          type="button"
          onClick={borrarCampania}
          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Borrar campaña
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Título del mail</label>
          <input
            ref={tituloRef}
            name="titulo_mail"
            placeholder="Ej: 20% OFF en alimento para gatos"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Remitente</label>
          <input
            ref={remitenteRef}
            name="remitente"
            type="email"
            placeholder="ejemplo@estacionmascotera.com.ar"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Cuerpo del mail</label>
          <div
            ref={cuerpoRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Pegá acá el texto o las imágenes del mail..."
            className="h-[260px] overflow-y-auto rounded-md border border-gray-300 px-3 py-2 text-sm empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)] [&_img]:my-2 [&_img]:max-w-full"
          />
        </div>
      </div>
    </div>
  );
}
