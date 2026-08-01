import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { desvincularItem } from "./actions";

export default async function VinculacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedor?: string; sin?: string }>;
}) {
  await requireAdmin();
  const { proveedor: proveedorFiltro, sin } = await searchParams;
  const soloSinVincular = sin === "1";

  const [historial, proveedores] = await Promise.all([
    prisma.historialStockMayorista.findMany({
      where: {
        activo: true,
        proveedorId: { not: null },
        ...(proveedorFiltro ? { proveedorId: Number(proveedorFiltro) } : {}),
        ...(soloSinVincular ? { productoId: null } : {}),
      },
      include: {
        proveedor: { select: { id: true, nombre: true } },
        producto: { select: { id: true, skuInterno: true, nombre: true } },
      },
      orderBy: [{ proveedor: { nombre: "asc" } }, { nombre: "asc" }],
    }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const vinculados = historial.filter((h) => h.productoId !== null);
  const sinVincular = historial.filter((h) => h.productoId === null);

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">Vinculaciones lista → catálogo</h1>
        <div className="text-sm text-gray-500">
          <span className="font-medium text-green-700">{vinculados.length} vinculados</span>
          {" · "}
          <span className="font-medium text-orange-600">{sinVincular.length} sin vincular</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <a
          href="?"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${!proveedorFiltro && !soloSinVincular ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
        >
          Todos
        </a>
        <a
          href="?sin=1"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${soloSinVincular ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-orange-600 hover:bg-orange-50"}`}
        >
          Sin vincular ({sinVincular.length})
        </a>
        {proveedores.map((p) => (
          <a
            key={p.id}
            href={`?proveedor=${p.id}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${proveedorFiltro === String(p.id) ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {p.nombre}
          </a>
        ))}
      </div>

      {historial.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">
          No hay ítems para mostrar.
        </div>
      )}

      {historial.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-left">SKU proveedor</th>
                <th className="px-4 py-3 text-left">Nombre en lista</th>
                <th className="px-4 py-3 text-left">Producto catálogo</th>
                <th className="px-4 py-3 text-left">SKU interno</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historial.map((h) => (
                <tr key={h.id} className={h.productoId ? "hover:bg-gray-50" : "bg-orange-50 hover:bg-orange-100"}>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{h.proveedor?.nombre}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{h.sku}</td>
                  <td className="px-4 py-2.5 text-gray-700">{h.nombre ?? "—"}{h.tamanios ? ` · ${h.tamanios}` : ""}</td>
                  <td className="px-4 py-2.5">
                    {h.producto ? (
                      <Link
                        href={`/inventario/productos/${h.producto.id}/editar`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {h.producto.nombre}
                      </Link>
                    ) : (
                      <span className="text-xs text-orange-500 font-medium">Sin vincular</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-400">
                    {h.producto?.skuInterno ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {h.producto && (
                      <form action={desvincularItem}>
                        <input type="hidden" name="historialId" value={h.id} />
                        <button
                          type="submit"
                          className="text-xs text-red-500 hover:text-red-700 hover:underline"
                        >
                          Desvincular
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
