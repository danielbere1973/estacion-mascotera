import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { ResolverBtn } from "./resolver-btn";

export default async function PendientesHymPage() {
  await requireAdmin();

  const pendientes = await prisma.pendienteCompraMayorista.findMany({
    where: { estado: { in: ["PENDIENTE", "EN_PROCESO"] } },
    include: {
      producto: { select: { nombre: true, skuInterno: true } },
      proveedor: { select: { nombre: true } },
    },
    orderBy: { creadoAt: "asc" },
  });

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <Link href="/inventario" className="text-xs text-gray-400 hover:text-gray-600">← Inventario</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Pendientes de compra a mayorista</h1>
        </div>
        <div className="text-sm text-gray-500">
          <span className="font-medium text-gray-700">{pendientes.length} pendiente(s)</span>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Si ya compraste alguno de estos productos por fuera del corte automático (otro proveedor, en
        persona, etc.), marcalo como resuelto para que no se vuelva a incluir en el próximo pedido.
      </p>

      {pendientes.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">
          No hay pendientes de compra.
        </div>
      )}

      {/* Mobile: tarjetas */}
      {pendientes.length > 0 && (
        <ul className="space-y-2 md:hidden">
          {pendientes.map((p) => (
            <li key={p.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-gray-800">{p.producto.nombre}</p>
                <p className="shrink-0 font-medium text-gray-700">× {p.cantidad}</p>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {p.proveedor.nombre} · <span className="font-mono">{p.producto.skuInterno}</span> ·{" "}
                {p.estado === "EN_PROCESO" ? "En proceso" : "Pendiente"}
              </p>
              <div className="mt-2 border-t border-gray-100 pt-2">
                <ResolverBtn pendienteId={p.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {pendientes.length > 0 && (
        <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-left">SKU interno</th>
                <th className="px-4 py-3 text-left">Cantidad</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendientes.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs text-gray-500">{p.proveedor.nombre}</td>
                  <td className="px-4 py-2.5 text-gray-700">{p.producto.nombre}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{p.producto.skuInterno}</td>
                  <td className="px-4 py-2.5 text-gray-700">{p.cantidad}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {p.estado === "EN_PROCESO" ? "En proceso" : "Pendiente"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ResolverBtn pendienteId={p.id} />
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
