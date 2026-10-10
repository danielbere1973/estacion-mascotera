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

  const margenDe = (prov: (typeof proveedores)[number]) => {
    const items = prov.historialMayorista.filter((h) => h.producto);
    const margenes = items.map((h) => {
      const costo = Number(h.precioConDescuento ?? h.precioCostoScraped);
      const venta = Number(h.producto!.precioVenta);
      return costo > 0 ? ((venta - costo) / costo) * 100 : null;
    }).filter((m): m is number => m !== null);
    return margenes.length > 0 ? margenes.reduce((a, b) => a + b, 0) / margenes.length : null;
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <Link href="/inventario" className="text-xs text-gray-400 hover:text-gray-600">← Inventario</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Proveedores</h1>
      </div>

      {/* Formulario nuevo proveedor */}
      <form action={crearProveedor} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Nuevo proveedor</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input name="nombre" required placeholder="Nombre *" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="contacto" placeholder="Teléfono" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="direccion" placeholder="Dirección" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="accountManager" placeholder="Account Manager" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="horarios" placeholder="Horarios" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 sm:w-auto">
          + Agregar
        </button>
      </form>

      {/* Lista de proveedores — mobile: tarjetas */}
      <ul className="space-y-2 md:hidden">
        {proveedores.map((prov) => {
          const margenProm = margenDe(prov);
          return (
            <li key={prov.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/inventario/proveedores/${prov.id}`} className="min-w-0 font-medium text-blue-600">
                  {prov.nombre}
                </Link>
                <span className="shrink-0 text-xs text-gray-500">
                  {prov._count.historialMayorista} prod.
                  {margenProm !== null && (
                    <span className={`ml-2 font-medium ${margenProm >= 25 ? "text-green-600" : "text-orange-500"}`}>
                      {margenProm.toFixed(1)}%
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                {prov.contacto && <p>{prov.contacto}</p>}
                {prov.direccion && <p>{prov.direccion}</p>}
                {prov.accountManager && <p>Account Manager: {prov.accountManager}</p>}
                {prov.horarios && <p>Horarios: {prov.horarios}</p>}
              </div>
              <div className="mt-2 flex justify-end gap-4 border-t border-gray-100 pt-2">
                <Link href={`/inventario/proveedores/${prov.id}/editar`} className="text-xs text-blue-600">
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
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2">Teléfono</th>
              <th className="px-4 py-2">Dirección</th>
              <th className="px-4 py-2">Account Manager</th>
              <th className="px-4 py-2">Horarios</th>
              <th className="px-4 py-2 text-right">Productos</th>
              <th className="px-4 py-2 text-right">Margen promedio</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {proveedores.map((prov) => {
              const margenProm = margenDe(prov);

              return (
                <tr key={prov.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/inventario/proveedores/${prov.id}`} className="font-medium text-blue-600 hover:underline">
                      {prov.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{prov.contacto ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{prov.direccion ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{prov.accountManager ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{prov.horarios ?? "—"}</td>
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
