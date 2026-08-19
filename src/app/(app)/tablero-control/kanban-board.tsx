"use client";

import { useState, useTransition } from "react";
import { Combobox } from "@/components/combobox";
import {
  crearColumna,
  crearTarjeta,
  editarColumna,
  eliminarColumna,
  eliminarTarjeta,
  moverTarjeta,
  reordenarColumnas,
} from "./actions";
import { EditarTarjetaModal } from "./editar-tarjeta-modal";

interface Columna {
  id: number;
  nombre: string;
  color: string;
}

interface Tarjeta {
  id: number;
  titulo: string;
  notas: string | null;
  columnaId: number;
  usuarioAsignadoId: number | null;
  ventaId: number | null;
  clienteId: number | null;
  usuarioAsignado: { nombre: string; apellido: string } | null;
  cliente: { nombre: string; apellido: string } | null;
}

interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
}

interface VentaOpcion {
  id: number;
  fechaVenta: string | Date;
  clienteNombre: string;
}

interface ClienteOpcion {
  id: number;
  nombre: string;
  apellido: string;
}

type DragItem = { type: "card" | "column"; id: number } | null;

export function KanbanBoard({
  columnas,
  tarjetas,
  usuarios,
  ventas,
  clientes,
}: {
  columnas: Columna[];
  tarjetas: Tarjeta[];
  usuarios: Usuario[];
  ventas: VentaOpcion[];
  clientes: ClienteOpcion[];
}) {
  const [dragItem, setDragItem] = useState<DragItem>(null);
  const [dragOverColId, setDragOverColId] = useState<number | null>(null);
  const [formTarjetaAbierto, setFormTarjetaAbierto] = useState(false);
  const [formColumnaAbierto, setFormColumnaAbierto] = useState(false);
  const [tarjetaEditando, setTarjetaEditando] = useState<Tarjeta | null>(null);
  const [columnaEditandoId, setColumnaEditandoId] = useState<number | null>(null);
  const [clienteIdNueva, setClienteIdNueva] = useState("");
  const [filtroClienteId, setFiltroClienteId] = useState("");
  const [, startTransition] = useTransition();

  const tarjetasVisibles = filtroClienteId
    ? tarjetas.filter((t) => String(t.clienteId) === filtroClienteId)
    : tarjetas;

  const opcionesCliente = clientes.map((c) => ({
    value: String(c.id),
    label: `${c.nombre} ${c.apellido}`,
    search: `${c.nombre} ${c.apellido}`,
  }));

  function guardarNombreColumna(col: Columna, nombre: string) {
    setColumnaEditandoId(null);
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio || nombreLimpio === col.nombre) return;
    startTransition(() => {
      editarColumna(col.id, nombreLimpio);
    });
  }

  function onDropEnColumna(columnaDestinoId: number) {
    setDragOverColId(null);
    const item = dragItem;
    setDragItem(null);
    if (!item) return;

    if (item.type === "card") {
      const tarjeta = tarjetas.find((t) => t.id === item.id);
      if (!tarjeta || tarjeta.columnaId === columnaDestinoId) return;
      startTransition(() => {
        moverTarjeta(item.id, columnaDestinoId);
      });
    } else {
      if (item.id === columnaDestinoId) return;
      const idsActuales = columnas.map((c) => c.id);
      const sinArrastrada = idsActuales.filter((id) => id !== item.id);
      const idxDestino = sinArrastrada.indexOf(columnaDestinoId);
      sinArrastrada.splice(idxDestino, 0, item.id);
      startTransition(() => {
        reordenarColumnas(sinArrastrada);
      });
    }
  }

  function onEliminarColumna(col: Columna) {
    if (columnas.length <= 1) {
      window.alert("No podés eliminar la última columna del tablero.");
      return;
    }
    const cantidadTarjetas = tarjetas.filter((t) => t.columnaId === col.id).length;
    const mensaje =
      cantidadTarjetas > 0
        ? `¿Desea eliminar la columna "${col.nombre}"? También se van a eliminar las ${cantidadTarjetas} tarjeta(s) que tiene dentro.`
        : `¿Desea eliminar la columna "${col.nombre}"?`;
    if (!window.confirm(mensaje)) return;
    startTransition(() => {
      eliminarColumna(col.id);
    });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Tablero de Control</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filtros:</span>
            <select
              value={filtroClienteId}
              onChange={(e) => setFiltroClienteId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.apellido}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setFormTarjetaAbierto(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Nueva tarjeta
          </button>
          <button
            onClick={() => setFormColumnaAbierto(true)}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            + Agregar Columna
          </button>
        </div>
      </div>

      {formColumnaAbierto && (
        <form
          action={(fd) => {
            crearColumna(fd);
            setFormColumnaAbierto(false);
          }}
          className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium text-gray-700">Nombre de la columna</label>
            <input
              name="nombre"
              required
              autoFocus
              placeholder="Ej: Reclamos"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Agregar
            </button>
            <button
              type="button"
              onClick={() => setFormColumnaAbierto(false)}
              className="rounded-md px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {formTarjetaAbierto && (
        <form
          action={(fd) => {
            crearTarjeta(fd);
            setFormTarjetaAbierto(false);
            setClienteIdNueva("");
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
            <label className="text-sm font-medium text-gray-700">Cliente (opcional)</label>
            <input type="hidden" name="clienteId" value={clienteIdNueva} />
            <Combobox
              options={opcionesCliente}
              value={clienteIdNueva}
              onSelect={setClienteIdNueva}
              placeholder="Buscar cliente..."
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
              onClick={() => {
                setFormTarjetaAbierto(false);
                setClienteIdNueva("");
              }}
              className="rounded-md px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
        {columnas.map((col) => {
          const tarjetasCol = tarjetasVisibles.filter((t) => t.columnaId === col.id);
          const isOver = dragOverColId === col.id;
          const isDraggingThisCol = dragItem?.type === "column" && dragItem.id === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverColId(col.id);
              }}
              onDragLeave={() => setDragOverColId((cur) => (cur === col.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                onDropEnColumna(col.id);
              }}
              className={`flex h-full w-64 shrink-0 flex-col rounded-xl border bg-gray-50 transition-colors ${
                isOver ? "border-blue-400 bg-blue-50" : "border-gray-200"
              } ${isDraggingThisCol ? "opacity-50" : ""}`}
            >
              <div
                draggable={columnaEditandoId !== col.id}
                onDragStart={(e) => {
                  e.stopPropagation();
                  setDragItem({ type: "column", id: col.id });
                }}
                onDragEnd={() => setDragItem(null)}
                style={{ backgroundColor: col.color }}
                className="flex cursor-grab items-center justify-between gap-1 rounded-t-xl px-3 py-2 active:cursor-grabbing"
                title="Arrastrá para reordenar la columna"
              >
                {columnaEditandoId === col.id ? (
                  <input
                    autoFocus
                    defaultValue={col.nombre}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => guardarNombreColumna(col, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setColumnaEditandoId(null);
                    }}
                    className="min-w-0 flex-1 rounded border border-white/40 bg-white/20 px-1.5 py-0.5 text-xs font-semibold text-white placeholder-white/70 outline-none"
                  />
                ) : (
                  <span className="min-w-0 truncate text-xs font-semibold text-white">{col.nombre}</span>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-medium text-white">
                    {tarjetasCol.length}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEliminarColumna(col);
                    }}
                    title="Eliminar columna"
                    className="rounded px-1.5 text-sm font-bold text-white/80 hover:bg-white/20 hover:text-white"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setColumnaEditandoId(col.id);
                    }}
                    title="Editar nombre de la columna"
                    className="rounded px-1.5 text-xs text-white/80 hover:bg-white/20 hover:text-white"
                  >
                    ✏️
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {tarjetasCol.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragItem({ type: "card", id: t.id })}
                    onDragEnd={() => setDragItem(null)}
                    onClick={() => setTarjetaEditando(t)}
                    className={`group cursor-pointer rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-blue-300 ${
                      dragItem?.type === "card" && dragItem.id === t.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900">{t.titulo}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        <span
                          style={{ backgroundColor: col.color }}
                          title={`Task ID: ${t.id}`}
                          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                        >
                          {t.id}
                        </span>
                        <form
                          action={eliminarTarjeta}
                          onClick={(e) => e.stopPropagation()}
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
                    </div>
                    {t.cliente && (
                      <p className="mt-1 text-xs text-gray-500">
                        🧑 {t.cliente.nombre} {t.cliente.apellido}
                      </p>
                    )}
                    {t.usuarioAsignado && (
                      <p className="mt-1 text-xs text-gray-500">
                        👤 {t.usuarioAsignado.nombre} {t.usuarioAsignado.apellido}
                      </p>
                    )}
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

      {tarjetaEditando && (
        <EditarTarjetaModal
          key={tarjetaEditando.id}
          tarjeta={tarjetaEditando}
          columnaNombre={columnas.find((c) => c.id === tarjetaEditando.columnaId)?.nombre ?? ""}
          usuarios={usuarios}
          ventas={ventas}
          clientes={clientes}
          onClose={() => setTarjetaEditando(null)}
        />
      )}
    </div>
  );
}
