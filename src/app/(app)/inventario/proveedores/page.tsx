import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { crearProveedor, eliminarProveedor } from "./actions";

export default async function ProveedoresPage() {
  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { historialMayorista: true } },
      historialMayorista: {
        where: { activo: true, productoId: { not: null } },
        select: {
          precioCostoScraped: true,
          precioConDescuento: true,
          producto: { select: { precioVenta: true } },
        },
      },
    },
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Proveedores</h1>
      </div>

      {/* Formulario nuevo proveedor */}
      <form action={crearProveedor} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Nuevo proveedor</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input name="nombre" required placeholder="Nombre *" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="contacto" placeholder="Contacto" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="direccion" placeholder="Dirección" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
          + Agregar
        </button>
      </form>

      {/* Lista de proveedores */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2">Contacto</th>
              <th className="px-4 py-2 text-right">Productos</th>
              <th className="px-4 py-2 text-right">Margen promedio</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {proveedores.map((prov) => {
              const items = prov.historialMayorista.filter((h) => h.producto);
              const margenes = items.map((h) => {
                const costo = Number(h.precioConDescuento ?? h.precioCostoScraped);
                const venta = Number(h.producto!.precioVenta);
                return costo > 0 ? ((venta - costo) / costo) * 100 : null;
              }).filter((m): m is number => m !== null);
              const margenProm = margenes.length > 0
                ? margenes.reduce((a, b) => a + b, 0) / margenes.length
                : null;

              return (
                <tr key={prov.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/inventario/proveedores/${prov.id}`} className="font-medium text-blue-600 hover:underline">
                      {prov.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{prov.contacto ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{prov._count.historialMayorista}</td>
                  <td className="px-4 py-3 text-right">
                    {margenProm !== null
                      ? <span className={margenProm >= 25 ? "text-green-600 font-medium" : "text-orange-500 font-medium"}>
                          {margenProm.toFixed(1)}%
                        </span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/inventario/proveedores/${prov.id}/editar`} className="text-xs text-blue-600 hover:underline">
                        Editar
                      </Link>
                      <form action={eliminarProveedor}>
                        <input type="hidden" name="id" value={prov.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`¿Eliminar "${prov.nombre}"?`}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Eliminar
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
