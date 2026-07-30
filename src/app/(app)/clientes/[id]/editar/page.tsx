import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { actualizarCliente } from "../../actions";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { id: Number(id) } });

  if (!cliente) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Editar cliente</h1>

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

        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Reposición</p>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              name="esRecurrente"
              defaultChecked={cliente.esRecurrente}
              className="rounded border-gray-300"
            />
            Cliente recurrente (recibe recordatorios de reposición)
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Período de reposición (días)
                <span className="ml-1 text-xs text-gray-400 font-normal">— se calcula automáticamente del historial</span>
              </label>
              <input
                name="periodoReposicionDias"
                type="number"
                min={1}
                defaultValue={cliente.periodoReposicionDias ?? ""}
                placeholder="Ej: 30"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Notas de reposición</label>
              <input
                name="notasReposicion"
                defaultValue={cliente.notasReposicion ?? ""}
                placeholder="Ej: prefiere que lo llamen"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
