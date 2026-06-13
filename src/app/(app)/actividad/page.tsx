import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { Prisma } from "@prisma/client";

const ACCION_LABELS: Record<string, string> = {
  CREAR: "Crear",
  ACTUALIZAR: "Actualizar",
  ELIMINAR: "Eliminar",
};

const ENTIDAD_LABELS: Record<string, string> = {
  COMPRA: "Compra",
  VENTA: "Venta",
  GASTO: "Gasto",
  PRODUCTO: "Producto",
  USUARIO: "Usuario",
  PROVEEDOR: "Proveedor",
};

const ACCION_COLORS: Record<string, string> = {
  CREAR: "bg-green-50 text-green-700",
  ACTUALIZAR: "bg-blue-50 text-blue-700",
  ELIMINAR: "bg-red-50 text-red-700",
};

export default async function ActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ usuarioId?: string; desde?: string; hasta?: string }>;
}) {
  await requireAdmin();

  const { usuarioId, desde, hasta } = await searchParams;

  const where: Prisma.LogActividadWhereInput = {};
  if (usuarioId) where.usuarioId = Number(usuarioId);
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = new Date(`${desde}T00:00:00.000Z`);
    if (hasta) where.fecha.lte = new Date(`${hasta}T23:59:59.999Z`);
  }

  const [logs, usuarios] = await Promise.all([
    prisma.logActividad.findMany({
      where,
      orderBy: { fecha: "desc" },
      take: 200,
      include: { usuario: { select: { nombre: true, apellido: true } } },
    }),
    prisma.usuario.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, apellido: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Log de actividad</h1>

      <form className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Usuario</label>
          <select
            name="usuarioId"
            defaultValue={usuarioId ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} {u.apellido}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Desde</label>
          <input
            type="date"
            name="desde"
            defaultValue={desde ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Hasta</label>
          <input
            type="date"
            name="hasta"
            defaultValue={hasta ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Filtrar
          </button>
          <a
            href="/actividad"
            className="w-full rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          >
            Limpiar
          </a>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Acción</th>
              <th className="px-3 py-2">Entidad</th>
              <th className="px-3 py-2">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                  {formatDateTime(log.fecha)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {log.usuario.nombre} {log.usuario.apellido}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACCION_COLORS[log.accion] ?? ""}`}>
                    {ACCION_LABELS[log.accion] ?? log.accion}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                  {ENTIDAD_LABELS[log.entidad] ?? log.entidad}
                  {log.entidadId ? ` #${log.entidadId}` : ""}
                </td>
                <td className="px-3 py-2 text-gray-500">{log.detalle ?? "-"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  No hay actividad registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
