import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import {
  actualizarCliente,
  agregarProductoRecurrente,
  editarProductoRecurrente,
  eliminarProductoRecurrente,
} from "../../actions";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const clienteId = Number(id);

  const [cliente, productosRecurrentes, todosProductos] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: clienteId } }),
    prisma.clienteProductoRecurrente.findMany({
      where: { clienteId },
      include: { producto: { select: { id: true, nombre: true, marca: true } } },
      orderBy: { creadoAt: "asc" },
    }),
    prisma.producto.findMany({
      select: { id: true, nombre: true, marca: true },
      orderBy: [{ marca: "asc" }, { nombre: "asc" }],
    }),
  ]);

  if (!cliente) notFound();

  const productosYaAgregados = new Set(productosRecurrentes.map((r) => r.productoId));
  const productosDisponibles = todosProductos.filter((p) => !productosYaAgregados.has(p.id));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Editar cliente</h1>

      {/* Datos del cliente */}
      <form action={actualizarCliente} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="id" value={cliente.id} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <input
              name="nombre"
              defaultValue={cliente.nombre}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Apellido</label>
            <input
              name="apellido"
              defaultValue={cliente.apellido}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Dirección</label>
            <input
              name="direccion"
              defaultValue={cliente.direccion}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Teléfono</label>
            <input
              name="telefono"
              defaultValue={cliente.telefono}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Email (opcional)</label>
            <input
              name="email"
              type="email"
              defaultValue={cliente.email ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Guardar cambios
        </button>
      </form>

      {/* Productos recurrentes */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Productos recurrentes</h2>
        <p className="text-xs text-gray-500">
          Configurá qué productos compra habitualmente este cliente y cada cuántos días. El sistema va a recordarte cuándo contactarlo.
        </p>

        {productosRecurrentes.length > 0 && (
          <div className="space-y-2">
            {productosRecurrentes.map((r) => (
              <div key={r.id} className={`rounded-lg border px-3 py-2 text-sm ${r.activo ? "border-gray-200 bg-gray-50" : "border-gray-100 bg-white opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">
                      {r.producto.marca} — {r.producto.nombre}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      cada {r.periodoDias} días
                      {r.notas && <span className="ml-2 text-gray-400">· {r.notas}</span>}
                      {!r.activo && <span className="ml-2 text-gray-400 italic">inactivo</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <form action={editarProductoRecurrente}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="periodoDias" value={r.periodoDias} />
                      <input type="hidden" name="notas" value={r.notas ?? ""} />
                      <input type="hidden" name="activo" value={r.activo ? "false" : "true"} />
                      <button
                        type="submit"
                        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-200"
                        title={r.activo ? "Pausar" : "Activar"}
                      >
                        {r.activo ? "Pausar" : "Activar"}
                      </button>
                    </form>
                    <form action={eliminarProductoRecurrente}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {productosDisponibles.length > 0 && (
          <form action={agregarProductoRecurrente} className="space-y-3 border-t border-gray-100 pt-3">
            <input type="hidden" name="clienteId" value={cliente.id} />
            <p className="text-xs font-medium text-gray-600">Agregar producto</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Producto</label>
                <select
                  name="productoId"
                  required
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {productosDisponibles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.marca} — {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Cada cuántos días</label>
                <input
                  name="periodoDias"
                  type="number"
                  min={1}
                  required
                  placeholder="Ej: 30"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-gray-500">Notas (opcional)</label>
                <input
                  name="notas"
                  placeholder="Ej: mezcla con natural, prefiere ser llamado"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              Agregar producto
            </button>
          </form>
        )}

        {productosDisponibles.length === 0 && productosRecurrentes.length === 0 && (
          <p className="text-xs text-gray-400">No hay productos en el catálogo para agregar.</p>
        )}
      </div>
    </div>
  );
}
