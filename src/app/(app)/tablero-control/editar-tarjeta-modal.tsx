"use client";

import { useState } from "react";
import { Combobox } from "@/components/combobox";
import { formatDate } from "@/lib/format";
import { editarTarjeta } from "./actions";

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

interface Tarjeta {
  id: number;
  titulo: string;
  notas: string | null;
  usuarioAsignadoId: number | null;
  ventaId: number | null;
}

export function EditarTarjetaModal({
  tarjeta,
  columnaNombre,
  usuarios,
  ventas,
  onClose,
}: {
  tarjeta: Tarjeta;
  columnaNombre: string;
  usuarios: Usuario[];
  ventas: VentaOpcion[];
  onClose: () => void;
}) {
  const [ventaId, setVentaId] = useState(tarjeta.ventaId ? String(tarjeta.ventaId) : "");

  const opcionesVenta = ventas.map((v) => ({
    value: String(v.id),
    label: `#${v.id} · ${v.clienteNombre} · ${formatDate(v.fechaVenta)}`,
    search: `${v.id} ${v.clienteNombre}`,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Editar tarjeta</h2>
        <form
          action={(fd) => {
            editarTarjeta(fd);
            onClose();
          }}
          className="space-y-3"
        >
          <input type="hidden" name="id" value={tarjeta.id} />
          <input type="hidden" name="ventaId" value={ventaId} />

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Título</label>
            <input
              name="titulo"
              required
              autoFocus
              defaultValue={tarjeta.titulo}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Estado</label>
            <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {columnaNombre}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Staff asignado</label>
            <select
              name="usuarioAsignadoId"
              defaultValue={tarjeta.usuarioAsignadoId ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellido}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Venta asociada</label>
              {ventaId && (
                <button
                  type="button"
                  onClick={() => setVentaId("")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Quitar
                </button>
              )}
            </div>
            <Combobox
              options={opcionesVenta}
              value={ventaId}
              onSelect={setVentaId}
              placeholder="Buscar venta por cliente..."
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Notas</label>
            <textarea
              name="notas"
              rows={4}
              defaultValue={tarjeta.notas ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
