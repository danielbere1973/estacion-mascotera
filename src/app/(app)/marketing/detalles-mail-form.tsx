"use client";

import { useState, type ClipboardEvent, type RefObject } from "react";
import { subirImagenMail } from "./actions";

export function DetallesMailForm({
  tituloRef,
  cuerpoRef,
}: {
  tituloRef: RefObject<HTMLInputElement | null>;
  cuerpoRef: RefObject<HTMLDivElement | null>;
}) {
  const [subiendoImagen, setSubiendoImagen] = useState(false);

  function borrarCampania() {
    if (tituloRef.current) tituloRef.current.value = "";
    if (cuerpoRef.current) cuerpoRef.current.innerHTML = "";
  }

  async function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const itemImagen = Array.from(items).find((item) => item.type.startsWith("image/"));
    if (!itemImagen) return; // texto normal: dejar el pegado default del navegador

    e.preventDefault();
    const archivo = itemImagen.getAsFile();
    if (!archivo) return;

    setSubiendoImagen(true);
    try {
      const formData = new FormData();
      formData.append("file", archivo);
      const resultado = await subirImagenMail(formData);
      if (resultado.error || !resultado.url) {
        window.alert(resultado.error ?? "No se pudo subir la imagen.");
        return;
      }
      cuerpoRef.current?.focus();
      document.execCommand("insertHTML", false, `<img src="${resultado.url}" alt="" />`);
    } finally {
      setSubiendoImagen(false);
    }
  }

  function agregarLink() {
    const cuerpo = cuerpoRef.current;
    if (!cuerpo) return;

    const seleccion = window.getSelection();
    if (!seleccion || seleccion.rangeCount === 0 || seleccion.isCollapsed) {
      window.alert(
        "Primero seleccioná (con el mouse) el texto o la imagen a la que querés agregarle el link."
      );
      return;
    }
    const range = seleccion.getRangeAt(0);
    if (!cuerpo.contains(range.commonAncestorContainer)) {
      window.alert("La selección tiene que estar dentro del cuerpo del mail.");
      return;
    }

    // Algunos navegadores pierden la selección mientras el diálogo nativo
    // (prompt) está abierto — se guarda una copia para restaurarla después.
    const rangeGuardado = range.cloneRange();

    const url = window.prompt("Pegá la URL del link (ej: https://www.instagram.com/...)", "https://");
    if (!url) return;

    cuerpo.focus();
    const seleccionActual = window.getSelection();
    seleccionActual?.removeAllRanges();
    seleccionActual?.addRange(rangeGuardado);

    document.execCommand("createLink", false, url);
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Detalles del mail</p>
        <button
          type="button"
          onClick={borrarCampania}
          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
        >
          Borrar campaña
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
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
          <p className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            contacto@estacionmascotera.com.ar
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Cuerpo del mail</label>
            <div className="flex items-center gap-2">
              {subiendoImagen && <span className="text-xs text-gray-400">Subiendo imagen...</span>}
              <button
                type="button"
                onClick={agregarLink}
                title="Seleccioná texto o una imagen y hacé clic acá para convertirlo en link"
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                🔗 Agregar link
              </button>
            </div>
          </div>
          <div
            ref={cuerpoRef}
            contentEditable
            suppressContentEditableWarning
            onPaste={handlePaste}
            data-placeholder="Pegá acá el texto o las imágenes del mail..."
            className="min-h-0 flex-1 overflow-y-auto rounded-md border border-gray-300 px-3 py-2 text-sm empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)] [&_img]:my-2 [&_img]:max-w-full [&_a]:text-blue-600 [&_a]:underline"
          />
        </div>
      </div>
    </div>
  );
}
