"use client";

import { useRef, useState, useTransition } from "react";
import { importarExcel } from "./actions";

export function ImportarExcel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function procesarArchivo(file: File) {
    setError(null);
    setResultado(null);
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      try {
        const res = await importarExcel(formData);
        setResultado(
          `Procesados ${res.total} productos · ${res.actualizados} actualizados (precio de costo y venta)` +
            (res.sinCoincidencia > 0
              ? ` · ${res.sinCoincidencia} sin coincidencia por nombre`
              : "")
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al procesar el archivo.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) procesarArchivo(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors ${
          dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 text-gray-500 hover:bg-gray-50"
        }`}
      >
        {isPending ? (
          <p>Procesando...</p>
        ) : (
          <p>
            Arrastrá el archivo acá o <span className="text-blue-600 underline">elegí un archivo</span>
            <br />
            <span className="text-xs text-gray-400">
              Lista de precios del mayorista: Nombre, Tamaño, Precio Lista, Precio c/dto, Estado de stock, Codigo, SKU
            </span>
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) procesarArchivo(file);
          }}
        />
      </div>

      {resultado && <p className="text-sm text-green-600">{resultado}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
