"use client";

import { useRef, useState, useTransition } from "react";
import { importarExcel } from "./actions";
import { ProveedorSelector } from "./proveedor-selector";

type Proveedor = {
  id: number;
  nombre: string;
};

type PosibleCodigoReasignado = {
  codigoNuevo: string | null;
  sku: string;
  nombre: string;
  tamanios: string | null;
  codigoViejoCandidato: string | null;
  skuViejoCandidato: string;
  productoExistente: { id: number; skuInterno: string; nombre: string };
};

export function ImportarExcel({ proveedores }: { proveedores: Proveedor[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasignaciones, setReasignaciones] = useState<PosibleCodigoReasignado[]>([]);

  function procesarArchivo(file: File) {
    setError(null);
    setResultado(null);
    setReasignaciones([]);

    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    formData.set("file", file);

    if (!formData.get("proveedorId")) {
      setError("Seleccioná el proveedor de la lista de precios.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await importarExcel(formData);
        const partes = [
          `Procesados ${res.total} productos`,
          `${res.actualizados} actualizados`,
        ];
        if (res.nuevos > 0) partes.push(`${res.nuevos} nuevos creados en el catálogo`);
        setResultado(partes.join(" · "));
        setReasignaciones(res.posiblesReasignaciones ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al procesar el archivo.");
      }
    });
  }

  return (
    <form ref={formRef} className="space-y-3" onSubmit={(e) => e.preventDefault()}>
      <ProveedorSelector proveedores={proveedores} />

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

      {reasignaciones.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">
            🔎 {reasignaciones.length} posible(s) código(s) reasignado(s) por HYM — mismo nombre y peso que un
            producto existente, pero código nuevo. No se creó producto nuevo ni se vinculó automáticamente;
            revisar y corregir a mano.
          </p>
          <ul className="mt-2 space-y-1">
            {reasignaciones.map((r, i) => (
              <li key={i}>
                {r.nombre} ({r.tamanios ?? "sin tamaño"}): código viejo{" "}
                <strong>{r.codigoViejoCandidato ?? r.skuViejoCandidato}</strong> ({r.productoExistente.skuInterno})
                {" → "}código nuevo <strong>{r.codigoNuevo ?? r.sku}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
