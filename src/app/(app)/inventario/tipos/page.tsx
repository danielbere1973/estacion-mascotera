import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { crearTipoProducto, eliminarTipoProducto } from "./actions";

export default async function TiposProductoPage() {
  await requireAdmin();

  const tipos = await prisma.tipoProducto.findMany({ orderBy: { nombre: "asc" } });

  const conProductos = await prisma.producto.groupBy({
    by: ["categoria"],
    _count: { _all: true },
  });
  const conteo = new Map(conProductos.map((g) => [g.categoria, g._count._all]));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Tipos de producto</h1>

      <form action={crearTipoProducto} className="flex gap-2">
        <input
          name="nombre"
          placeholder="Nuevo tipo (ej: Medicamento)"
          required
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Agregar
        </button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2 text-right">Productos</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tipos.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{t.nombre}</td>
                <td className="px-3 py-2 text-right text-gray-500">{conteo.get(t.nombre) ?? 0}</td>
                <td className="px-3 py-2 text-right">
                  <form action={eliminarTipoProducto}>
                    <input type="hidden" name="id" value={t.id} />
                    <ConfirmSubmitButton
                      confirmMessage={`¿Eliminar el tipo "${t.nombre}"?`}
                      className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </ConfirmSubmitButton>
                  </form>
                </td>
              </tr>
            ))}
            {tipos.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-400">
                  No hay tipos configurados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
