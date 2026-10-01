import { TipoMascota } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

const TIPO_LABEL: Record<TipoMascota, string> = {
  PERRO: "Perro",
  GATO: "Gato",
};

export default async function RemindersPage() {
  await requireAdmin();

  // Una fila por mascota; "Última compra" es el ID de la venta más reciente del cliente.
  const mascotas = await prisma.mascota.findMany({
    orderBy: [{ cliente: { nombre: "asc" } }, { cliente: { apellido: "asc" } }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      tipo: true,
      raza: true,
      cliente: {
        select: {
          nombre: true,
          apellido: true,
          ventas: { orderBy: { fechaVenta: "desc" }, take: 1, select: { id: true } },
        },
      },
    },
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-900">Marketing — Reminders</h1>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Mascota</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Raza</th>
              <th className="px-3 py-2">Última compra</th>
              <th className="px-3 py-2">Último reminder</th>
              <th className="px-3 py-2">Próximo reminder</th>
              <th className="px-3 py-2">Setup reminder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {mascotas.map((m) => {
              const ultimaVenta = m.cliente.ventas[0];
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">
                    {m.cliente.nombre} {m.cliente.apellido}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{m.nombre}</td>
                  <td className="px-3 py-2 text-gray-600">{TIPO_LABEL[m.tipo]}</td>
                  <td className="px-3 py-2 text-gray-600">{m.raza ?? "-"}</td>
                  <td className="px-3 py-2 text-gray-600">{ultimaVenta ? `#${ultimaVenta.id}` : "-"}</td>
                  <td className="px-3 py-2 text-gray-400">-</td>
                  <td className="px-3 py-2 text-gray-400">-</td>
                  <td className="px-3 py-2 text-gray-400">-</td>
                </tr>
              );
            })}
            {mascotas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  No hay mascotas cargadas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
