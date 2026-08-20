"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Combobox } from "@/components/combobox";
import { formatCurrency, formatDate } from "@/lib/format";
import { editarTarjeta, obtenerProductosVenta } from "./actions";

interface ProductoVenta {
  sku: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
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

interface Tarjeta {
  id: number;
  titulo: string;
  notas: string | null;
  usuarioAsignadoId: number | null;
  ventaId: number | null;
  clienteId: number | null;
}

export function EditarTarjetaModal({
  tarjeta,
  columnaNombre,
  usuarios,
  ventas,
  clientes,
  onClose,
}: {
  tarjeta: Tarjeta;
  columnaNombre: string;
  usuarios: Usuario[];
  ventas: VentaOpcion[];
  clientes: ClienteOpcion[];
  onClose: () => void;
}) {
  const [ventaId, setVentaId] = useState(tarjeta.ventaId ? String(tarjeta.ventaId) : "");
  const [clienteId, setClienteId] = useState(tarjeta.clienteId ? String(tarjeta.clienteId) : "");
  const [productos, setProductos] = useState<ProductoVenta[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(false);

  useEffect(() => {
    if (!ventaId) return;
    let cancelado = false;
    Promise.resolve()
      .then(() => {
        if (!cancelado) setCargandoProductos(true);
        return obtenerProductosVenta(Number(ventaId));
      })
      .then((r) => {
        if (!cancelado) setProductos(r);
      })
      .finally(() => {
        if (!cancelado) setCargandoProductos(false);
      });
    return () => {
      cancelado = true;
    };
  }, [ventaId]);

  const totalProductos = productos.reduce((acc, p) => acc + p.subtotal, 0);

  const opcionesVenta = ventas.map((v) => ({
    value: String(v.id),
    label: `#${v.id} · ${v.clienteNombre} · ${formatDate(v.fechaVenta)}`,
    search: `${v.id} ${v.clienteNombre}`,
  }));

  const opcionesCliente = clientes.map((c) => ({
    value: String(c.id),
    label: `${c.nombre} ${c.apellido}`,
    search: `${c.nombre} ${c.apellido}`,
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
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Editar tarjeta</h2>
          <span className="text-xs text-gray-400">Task ID: {tarjeta.id}</span>
        </div>
        <form
          action={(fd) => {
            editarTarjeta(fd);
            onClose();
          }}
          className="space-y-3"
        >
          <input type="hidden" name="id" value={tarjeta.id} />
          <input type="hidden" name="ventaId" value={ventaId} />
          <input type="hidden" name="clienteId" value={clienteId} />

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
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Cliente</label>
              {clienteId && (
                <button
                  type="button"
                  onClick={() => setClienteId("")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Quitar
                </button>
              )}
            </div>
            <Combobox
              options={opcionesCliente}
              value={clienteId}
              onSelect={setClienteId}
              placeholder="Buscar cliente..."
            />
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
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setVentaId("")}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Quitar
                  </button>
                  <Link
                    href={`/ventas/${ventaId}/editar`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Ir a la Venta
                  </Link>
                </div>
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
            <label className="text-sm font-medium text-gray-700">Productos</label>
            {!ventaId && (
              <p className="text-xs text-gray-400">Seleccioná una venta para ver sus productos.</p>
            )}
            {ventaId && cargandoProductos && (
              <p className="text-xs text-gray-400">Cargando productos...</p>
            )}
            {ventaId && !cargandoProductos && productos.length === 0 && (
              <p className="text-xs text-gray-400">Esa venta no tiene productos cargados.</p>
            )}
            {ventaId && !cargandoProductos && productos.length > 0 && (
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-left text-[10px] uppercase text-gray-400">
                    <tr>
                      <th className="px-2 py-1">SKU</th>
                      <th className="px-2 py-1">Descripción</th>
                      <th className="px-2 py-1 text-right">Cant.</th>
                      <th className="px-2 py-1 text-right">Precio Unit.</th>
                      <th className="px-2 py-1 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[10px]">
                    {productos.map((p, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap px-2 py-1 font-mono text-gray-500">{p.sku}</td>
                        <td className="px-2 py-1 text-gray-700">{p.descripcion}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-right text-gray-700">{p.cantidad}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-right text-gray-700">
                          {formatCurrency(p.precioUnitario)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-right font-medium text-gray-800">
                          {formatCurrency(p.subtotal)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={4} className="px-2 py-1 text-right font-semibold text-gray-700">
                        Total
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-right font-semibold text-gray-900">
                        {formatCurrency(totalProductos)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
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
