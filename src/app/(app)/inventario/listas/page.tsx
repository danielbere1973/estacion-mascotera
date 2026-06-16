import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { eliminarItemMayorista } from "../actions";

export default async function ListasMayoristaPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedorId?: string }>;
}) {
  const params = await searchParams;
  const proveedorId = params.proveedorId ? Number(params.proveedorId) : undefined;

  const proveedores = await prisma.proveedor.findMany({ orderBy: { nombre: "asc" } });

  let items: {
    id: number;
    sku: string;
    nombre: string | null;
    precioCostoScraped: string;
    precioConDescuento: string | null;
    tamanios: string | null;
    productoId: number | null;
  }[] = [];

  if (proveedorId) {
    const historial = await prisma.historialStockMayorista.findMany({
      where: { proveedorId },
      orderBy: { fechaImportacion: "desc" },
    });

    const vistos = new Set<string>();
    for (const h of historial) {
      if (vistos.has(h.sku)) continue;
      vistos.add(h.sku);
      items.push({
        id: h.id,
        sku: h.sku,
        nombre: h.nombre,
        precioCostoScraped: h.precioCostoScraped.toString(),
        precioConDescuento: h.precioConDescuento?.toString() ?? null,
        tamanios: h.tamanios,
        productoId: h.productoId,
      });
    }
    items.sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Listas de precios por proveedor</h1>

      <form className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Proveedor</label>
          <select
            name="proveedorId"
            defaultValue={proveedorId ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Seleccionar proveedor...
            </option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-800 px-3 py-2 text-white hover:bg-gray-900"
        >
          Ver lista
        </button>
      </form>

      {proveedorId && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Tamaño</th>
                <th className="px-3 py-2 text-right">Precio Lista</th>
                <th className="px-3 py-2 text-right">Precio c/dto</th>
                <th className="px-3 py-2">Vinculado</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{item.sku}</td>
                  <td className="px-3 py-2">{item.nombre}</td>
                  <td className="whitespace-nowrap px-3 py-2">{item.tamanios ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatCurrency(item.precioCostoScraped)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {item.precioConDescuento ? formatCurrency(item.precioConDescuento) : "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {item.productoId ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Sí
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        No
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {!item.productoId && (
                        <Link
                          href={`/inventario/listas/${item.id}/crear-producto?proveedorId=${proveedorId}`}
                          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Crear producto
                        </Link>
                      )}
                      <Link
                        href={`/inventario/listas/${item.id}/editar?proveedorId=${proveedorId}`}
                        className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                      >
                        Editar
                      </Link>
                      <form action={eliminarItemMayorista}>
                        <input type="hidden" name="proveedorId" value={proveedorId} />
                        <input type="hidden" name="sku" value={item.sku} />
                        <ConfirmSubmitButton
                          confirmMessage="¿Eliminar este producto de la lista de precios del proveedor?"
                          className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Eliminar
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                    Este proveedor no tiene una lista de precios importada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
