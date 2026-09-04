"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type RefObject } from "react";
import { subirImagenMail } from "./actions";

const FUENTES = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Arial Black", value: "'Arial Black', sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Cambria", value: "Cambria, serif" },
  { label: "Candara", value: "Candara, sans-serif" },
  { label: "Comic Sans MS", value: "'Comic Sans MS', cursive" },
  { label: "Consolas", value: "Consolas, monospace" },
  { label: "Constantia", value: "Constantia, serif" },
  { label: "Corbel", value: "Corbel, sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Franklin Gothic Medium", value: "'Franklin Gothic Medium', sans-serif" },
  { label: "Garamond", value: "Garamond, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Lucida Console", value: "'Lucida Console', monospace" },
  { label: "Lucida Sans Unicode", value: "'Lucida Sans Unicode', sans-serif" },
  { label: "Palatino Linotype", value: "'Palatino Linotype', serif" },
  { label: "Segoe UI", value: "'Segoe UI', sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
];

const TAMANIOS_FUENTE = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];

// Paleta tipo Word/Google Docs: escala de grises + colores estándar + tenues.
const PALETA_COLORES = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff",
  "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
];

function IconAlinear({ tipo }: { tipo: "izquierda" | "centro" | "derecha" | "justificar" }) {
  const paths: Record<typeof tipo, string> = {
    izquierda: "M4 6h16M4 12h10M4 18h14",
    centro: "M4 6h16M7 12h10M5 18h14",
    derecha: "M4 6h16M10 12h10M6 18h14",
    justificar: "M4 6h16M4 12h16M4 18h16",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d={paths[tipo]} />
    </svg>
  );
}

export function DetallesMailForm({
  tituloRef,
  cuerpoRef,
}: {
  tituloRef: RefObject<HTMLInputElement | null>;
  cuerpoRef: RefObject<HTMLDivElement | null>;
}) {
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [arrastrandoImagen, setArrastrandoImagen] = useState(false);
  const [mostrarPaletaColor, setMostrarPaletaColor] = useState(false);
  const [fuenteSeleccionActual, setFuenteSeleccionActual] = useState("");
  const [tamanioSeleccionActual, setTamanioSeleccionActual] = useState("");
  const seleccionGuardadaRef = useRef<Range | null>(null);

  // Guarda la selección de texto del cuerpo del mail cada vez que cambia,
  // para poder restaurarla al hacer clic en un botón del panel de formato
  // (que de otra forma le robaría el foco al contentEditable, perdiéndola).
  useEffect(() => {
    function alCambiarSeleccion() {
      const cuerpo = cuerpoRef.current;
      const seleccion = window.getSelection();
      if (!cuerpo || !seleccion || seleccion.rangeCount === 0) return;
      const rango = seleccion.getRangeAt(0);
      if (cuerpo.contains(rango.commonAncestorContainer)) {
        seleccionGuardadaRef.current = rango.cloneRange();
      }
    }
    document.addEventListener("selectionchange", alCambiarSeleccion);
    return () => document.removeEventListener("selectionchange", alCambiarSeleccion);
  }, [cuerpoRef]);

  function borrarCampania() {
    if (tituloRef.current) tituloRef.current.value = "";
    if (cuerpoRef.current) cuerpoRef.current.innerHTML = "";
    seleccionGuardadaRef.current = null;
  }

  function aplicarFormato(comando: string, valor?: string) {
    const cuerpo = cuerpoRef.current;
    const rango = seleccionGuardadaRef.current;
    const seleccion = window.getSelection();
    if (!cuerpo || !rango || !seleccion) return;

    cuerpo.focus();
    if (cuerpo.contains(rango.commonAncestorContainer)) {
      seleccion.removeAllRanges();
      seleccion.addRange(rango);
    }
    document.execCommand(comando, false, valor);
  }

  // execCommand("fontSize") solo admite tamaños legacy 1-7 (HTML <font
  // size>), no puntos/píxeles reales. El truco estándar: aplicar el tamaño 7
  // (el más grande, fácil de encontrar) y reemplazar los <font size="7">
  // recién insertados por spans con el font-size real en px.
  function aplicarTamanioFuente(tamanioPx: string) {
    const cuerpo = cuerpoRef.current;
    if (!cuerpo) return;

    aplicarFormato("fontSize", "7");

    cuerpo.querySelectorAll('font[size="7"]').forEach((fontEl) => {
      const span = document.createElement("span");
      span.style.fontSize = `${tamanioPx}px`;
      span.innerHTML = fontEl.innerHTML;
      fontEl.replaceWith(span);
    });
  }

  async function subirEInsertarImagen(archivo: File) {
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

  async function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const itemImagen = Array.from(items).find((item) => item.type.startsWith("image/"));
    if (!itemImagen) return; // texto normal: dejar el pegado default del navegador

    e.preventDefault();
    const archivo = itemImagen.getAsFile();
    if (!archivo) return;

    await subirEInsertarImagen(archivo);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    // Solo intercepta cuando lo que se arrastra son archivos reales (desde
    // el explorador de Windows u otra app) — no toca el arrastre interno de
    // texto/imágenes ya existentes dentro del editor.
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    setArrastrandoImagen(true);
  }

  function handleDragLeave() {
    setArrastrandoImagen(false);
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    const tieneArchivos = Array.from(e.dataTransfer?.types ?? []).includes("Files");
    if (!tieneArchivos) return;

    e.preventDefault();
    setArrastrandoImagen(false);

    // Intenta ubicar el cursor donde se soltó el archivo, si el navegador lo permite.
    const cuerpo = cuerpoRef.current;
    if (cuerpo) {
      cuerpo.focus();
      const doc = document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
      };
      const rango = doc.caretRangeFromPoint?.(e.clientX, e.clientY);
      // Solo se usa si realmente cae dentro del cuerpo del mail — si por
      // algún motivo el navegador devuelve una posición fuera, se deja el
      // cursor donde estaba (mejor al final que insertar en otro lugar).
      if (rango && cuerpo.contains(rango.commonAncestorContainer)) {
        const seleccion = window.getSelection();
        seleccion?.removeAllRanges();
        seleccion?.addRange(rango);
      }
    }

    const archivos = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (archivos.length === 0) {
      window.alert("Solo se pueden soltar imágenes.");
      return;
    }

    for (const archivo of archivos) {
      await subirEInsertarImagen(archivo);
    }
  }

  function agregarLink() {
    const cuerpo = cuerpoRef.current;
    const rangoGuardado = seleccionGuardadaRef.current;
    if (!cuerpo || !rangoGuardado || rangoGuardado.collapsed) {
      window.alert(
        "Primero seleccioná (con el mouse) el texto o la imagen a la que querés agregarle el link."
      );
      return;
    }
    if (!cuerpo.contains(rangoGuardado.commonAncestorContainer)) {
      window.alert("La selección tiene que estar dentro del cuerpo del mail.");
      return;
    }

    const url = window.prompt("Pegá la URL del link (ej: https://www.instagram.com/...)", "https://");
    if (!url) return;

    cuerpo.focus();

    // Si lo seleccionado es una sola imagen (sin texto alrededor), la
    // envolvemos en <a> a mano: execCommand("createLink") no es confiable
    // para envolver elementos que no son texto en todos los navegadores.
    const contenidoClonado = rangoGuardado.cloneContents();
    const imagenes = contenidoClonado.querySelectorAll("img");
    const esSoloImagen =
      imagenes.length === 1 && (contenidoClonado.textContent ?? "").trim() === "";

    if (esSoloImagen) {
      try {
        const link = document.createElement("a");
        link.href = url;
        rangoGuardado.surroundContents(link);
        return;
      } catch {
        // Si por algún motivo no se puede envolver directo (rango parcial,
        // etc.), seguimos con el camino de texto como respaldo.
      }
    }

    const seleccionActual = window.getSelection();
    seleccionActual?.removeAllRanges();
    seleccionActual?.addRange(rangoGuardado);
    document.execCommand("createLink", false, url);
  }

  const botonClass =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-50";

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-gray-700">Cuerpo del mail</label>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {/* Formato de fuente */}
              <select
                value={fuenteSeleccionActual}
                onChange={(e) => {
                  aplicarFormato("fontName", e.target.value);
                  setFuenteSeleccionActual(e.target.value);
                }}
                title="Fuente"
                className="rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-700"
              >
                <option value="" disabled>
                  Fuente
                </option>
                {FUENTES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              <select
                value={tamanioSeleccionActual}
                onChange={(e) => {
                  aplicarTamanioFuente(e.target.value);
                  setTamanioSeleccionActual(e.target.value);
                }}
                title="Tamaño"
                className="rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-700"
              >
                <option value="" disabled>
                  Tamaño
                </option>
                {TAMANIOS_FUENTE.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <button type="button" onClick={() => aplicarFormato("bold")} title="Negrita" className={`${botonClass} font-bold`}>
                N
              </button>
              <button type="button" onClick={() => aplicarFormato("italic")} title="Cursiva" className={`${botonClass} italic`}>
                K
              </button>
              <button
                type="button"
                onClick={() => aplicarFormato("underline")}
                title="Subrayado"
                className={`${botonClass} underline`}
              >
                S
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMostrarPaletaColor((v) => !v)}
                  title="Color de fuente"
                  className={botonClass}
                >
                  <span className="font-bold text-red-600">A</span>
                </button>
                {mostrarPaletaColor && (
                  <div className="absolute right-0 top-8 z-20 grid w-56 grid-cols-9 gap-1.5 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                    {PALETA_COLORES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          aplicarFormato("foreColor", color);
                          setMostrarPaletaColor(false);
                        }}
                        title={color}
                        style={{ backgroundColor: color }}
                        className="h-4 w-4 shrink-0 rounded-sm border border-gray-300 transition hover:scale-125 hover:shadow-md"
                      />
                    ))}
                  </div>
                )}
              </div>

              <button type="button" onClick={() => aplicarFormato("justifyLeft")} title="Alinear a la izquierda" className={botonClass}>
                <IconAlinear tipo="izquierda" />
              </button>
              <button type="button" onClick={() => aplicarFormato("justifyCenter")} title="Centrar" className={botonClass}>
                <IconAlinear tipo="centro" />
              </button>
              <button type="button" onClick={() => aplicarFormato("justifyRight")} title="Alinear a la derecha" className={botonClass}>
                <IconAlinear tipo="derecha" />
              </button>
              <button type="button" onClick={() => aplicarFormato("justifyFull")} title="Justificar" className={botonClass}>
                <IconAlinear tipo="justificar" />
              </button>

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
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-placeholder="Pegá o arrastrá acá el texto o las imágenes del mail..."
            className={`min-h-0 flex-1 overflow-y-auto rounded-md border px-3 py-2 text-sm empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)] [&_img]:my-2 [&_img]:max-w-full [&_a]:text-blue-600 [&_a]:underline ${
              arrastrandoImagen ? "border-2 border-dashed border-blue-500 bg-blue-50" : "border-gray-300"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
