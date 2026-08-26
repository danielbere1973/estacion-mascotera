"use client";

import { useState } from "react";
import { crearCliente } from "./actions";

export function AltaClienteModal() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Alta cliente
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAbierto(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Alta de cliente</h2>
            <form
              action={(fd) => {
                crearCliente(fd);
                setAbierto(false);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Nombre</label>
                  <input
                    name="nombre"
                    required
                    autoFocus
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Apellido</label>
                  <input
                    name="apellido"
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Dirección</label>
                  <input
                    name="direccion"
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Teléfono</label>
                  <input
                    name="telefono"
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Email (opcional)</label>
                  <input
                    name="email"
                    type="email"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">CUIT (opcional)</label>
                  <input
                    name="cuit"
                    placeholder="Ej: 20-12345678-9"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">DNI (opcional)</label>
                  <input
                    name="dni"
                    placeholder="Ej: 12345678"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
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
      )}
    </>
  );
}
