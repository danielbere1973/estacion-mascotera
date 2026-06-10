import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";

const CANAL_LABELS: Record<string, string> = {
  TIENDANUBE: "Tiendanube",
  WHATSAPP: "WhatsApp",
  TELEFONO: "Teléfono",
};

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    clienteId?: string;
    facturado?: string;
  }>;
}) {
  const params = await searchParams;

  const where: Record<string, unknown> = {};

  if (params.desde || params.hasta) {
    where.fechaVenta = {
      ...(params.desde ? { gte: new Date(params.desde) } : {}),
      ...(params.hasta ? { lt: new Date(`${params.hasta}T23:59:59`) } : {}),
    };
  }

  if (params.clienteId) {
    where.clienteId = Number(params.clienteId);
  }

  if (params.facturado === "si") where.facturado = true;
  if (params.facturado === "no") where.facturado = false;

  const [ventas, clientes] = await Promise.all([
    prisma.venta.findMany({
      where,
      include: {
        cliente: true,
        detalles: { include: { producto: true } },
      },
      orderBy: { fechaVenta: "desc" },
      take: 100,
    }),
    prisma.cliente.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Ventas</h1>
        <Link
          href="/ventas/nueva"
          className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Nueva venta
        </Link>
      </div>

      <form className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm">
        <input
          type="date"
          name="desde"
          defaultValue={params.desde}
          className="rounded-md border border-gray-300 px-2 py-1"
        />
        <input
          type="date"
          name="hasta"
          defaultValue={params.hasta}
          className="rounded-md border border-gray-300 px-2 py-1"
        />
        <select
          name="clienteId"
          defaultValue={params.clienteId ?? ""}
          className="rounded-md border border-gray-300 px-2 py-1"
        >
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.apellido}
            </option>
          ))}
        </select>
        <select
          name="facturado"
          defaultValue={params.facturado ?? ""}
          className="rounded-md border border-gray-300 px-2 py-1"
        >
          <option value="">Facturado: todos</option>
          <option value="si">Facturado: sí</option>
          <option value="no">Facturado: no</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-800 px-3 py-1 text-white hover:bg-gray-900"
        >
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Canal</th>
              <th className="px-3 py-2">Pago</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Envío</th>
              <th className="px-3 py-2">Facturado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ventas.map((venta) => {
              const total = venta.detalles.reduce(
                (acc, d) => acc + d.cantidad * Number(d.precioVentaUnitario),
                0
              );
              return (
                <tr key={venta.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDate(venta.fechaVenta)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {venta.cliente.nombre} {venta.cliente.apellido}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {CANAL_LABELS[venta.canalVenta] ?? venta.canalVenta}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{venta.medioPago}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                    {formatCurrency(total)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatCurrency(Number(venta.costoEnvio))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {venta.facturado ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Sí {venta.numeroFactura ? `· ${venta.numeroFactura}` : ""}
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        No
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {ventas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  No hay ventas registradas para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
