"use client";

import { useState, useTransition } from "react";
import type { EstadoTablero } from "@prisma/client";
import { COLUMNAS } from "./columnas";
import { crearTarjeta, eliminarTarjeta, moverTarjeta } from "./actions";

interface Tarjeta {
  id: number;
  titulo: string;
  notas: string | null;
  estado: EstadoTablero;
}

export function KanbanBoard({ tarjetas }: { tarjetas: Tarjeta[] }) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverEstado, setDragOverEstado] = useState<EstadoTablero | null>(null);
  const [formAbiertoEn, setFormAbiertoEn] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onDrop(estado: EstadoTablero) {
    setDragOverEstado(null);
    if (dragId == null) return;
    const tarjeta = tarjetas.find((t) => t.id === dragId);
    setDragId(null);
    if (!tarjeta || tarjeta.estado === estado) return;
    startTransition(() => {
      moverTarjeta(dragId, estado);
    });
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Tablero de Control</h1>
        <button
          onClick={() => setFormAbiertoEn(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Nueva tarjeta
        </button>
      </div>

      {formAbiertoEn && (
        <form
          action={(fd) => {
            crearTarjeta(fd);
            setFormAbiertoEn(false);
          }}
          className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium text-gray-700">Título</label>
            <input
              name="titulo"
              required
              autoFocus
              placeholder="Ej: Orden #123 - Juan Pérez"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium text-gray-700">Notas (opcional)</label>
            <input
              name="notas"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => setFormAbiertoEn(false)}
              className="rounded-md px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNAS.map((col) => {
          const tarjetasCol = tarjetas.filter((t) => t.estado === col.estado);
          const isOver = dragOverEstado === col.estado;
          return (
            <div
              key={col.estado}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverEstado(col.estado);
              }}
              onDragLeave={() => setDragOverEstado((cur) => (cur === col.estado ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(col.estado);
              }}
              className={`flex w-64 shrink-0 flex-col rounded-xl border bg-gray-50 transition-colors ${
                isOver ? "border-blue-400 bg-blue-50" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-white px-3 py-2">
                <span className="text-xs font-semibold text-gray-700">{col.label}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  {tarjetasCol.length}
                </span>
              </div>

              <div className="flex-1 space-y-2 p-2">
                {tarjetasCol.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`group cursor-grab rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm active:cursor-grabbing ${
                      dragId === t.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900">{t.titulo}</p>
                      <form
                        action={eliminarTarjeta}
                        onSubmit={(e) => {
                          if (!window.confirm("¿Eliminar esta tarjeta?")) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          className="opacity-0 transition-opacity group-hover:opacity-100 text-gray-400 hover:text-red-600"
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </form>
                    </div>
                    {t.notas && <p className="mt-1 text-xs text-gray-500">{t.notas}</p>}
                  </div>
                ))}
                {tarjetasCol.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-gray-300">Sin tarjetas</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {isPending && <p className="text-xs text-gray-400">Guardando...</p>}
    </div>
  );
}
