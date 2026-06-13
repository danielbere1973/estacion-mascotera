import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CATEGORIA_GASTO_LABELS } from "@/lib/metrics";
import { actualizarGasto } from "../../actions";

export default async function EditarGastoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [gasto, usuariosActivos] = await Promise.all([
    prisma.gasto.findUnique({ where: { id: Number(id) } }),
    prisma.usuario.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, apellido: true },
    }),
  ]);

  if (!gasto) notFound();

  const fecha = gasto.fechaGasto.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Editar gasto</h1>

      <form
        action={actualizarGasto}
        className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={gasto.id} />

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            name="fechaGasto"
            defaultValue={fecha}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Tipo</label>
          <select
            name="categoriaGasto"
            required
            defaultValue={gasto.categoriaGasto}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {Object.entries(CATEGORIA_GASTO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Monto</label>
          <input
            type="number"
            name="monto"
            min={0}
            step="0.01"
            required
            defaultValue={gasto.monto.toString()}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Notas (opcional)</label>
          <input
            name="descripcion"
            defaultValue={gasto.descripcion ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Pagado por</label>
          <select
            name="pagadoPorId"
            defaultValue={gasto.pagadoPorId ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Sin especificar</option>
            {usuariosActivos.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} {u.apellido}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
