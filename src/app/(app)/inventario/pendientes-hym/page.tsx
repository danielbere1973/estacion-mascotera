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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">Pendientes de compra a mayorista</h1>
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

      {pendientes.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
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
