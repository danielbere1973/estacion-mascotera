import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export default async function ClientesPage() {
  await requireAdmin();

  const clientes = await prisma.cliente.findMany({
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    include: { _count: { select: { ventas: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Clientes</h1>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Teléfono</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Dirección</th>
              <th className="px-3 py-2 text-right">Ventas</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clientes.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">
                  {c.apellido}, {c.nombre}
                </td>
                <td className="px-3 py-2 text-gray-600">{c.telefono}</td>
                <td className="px-3 py-2 text-gray-600">{c.email ?? "-"}</td>
                <td className="px-3 py-2 text-gray-600">{c.direccion}</td>
                <td className="px-3 py-2 text-right text-gray-500">{c._count.ventas}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/clientes/${c.id}/editar`}
                    className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  No hay clientes cargados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
