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
    skuInterno: string | null;
    nombre: string | null;
    tipoProducto: string | null;
    precioCostoScraped: string;
    precioConDescuento: string | null;
    tamanios: string | null;
    precioVenta: string | null;
    vinculado: boolean;
  }[] = [];

  if (proveedorId) {
    const historial = await prisma.historialStockMayorista.findMany({
      where: { proveedorId },
      orderBy: { fechaImportacion: "desc" },
      select: {
        id: true,
        sku: true,
        skuInterno: true,
        nombre: true,
        tipoProducto: true,
        precioCostoScraped: true,
        precioConDescuento: true,
        tamanios: true,
        productoId: true,
        producto: { select: { precioVenta: true } },
      },
    });

    const vistos = new Set<string>();
    for (const h of historial) {
      if (vistos.has(h.sku)) continue;
      vistos.add(h.sku);
      items.push({
        id: h.id,
        sku: h.sku,
        skuInterno: h.skuInterno,
        nombre: h.nombre,
        tipoProducto: h.tipoProducto,
        precioCostoScraped: h.precioCostoScraped.toString(),
        precioConDescuento: h.precioConDescuento?.toString() ?? null,
        tamanios: h.tamanios,
        precioVenta: h.producto?.precioVenta?.toString() ?? null,
        vinculado: h.productoId !== null,
      });
    }
    items.sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <Link href="/inventario" className="text-xs text-gray-400 hover:text-gray-600">← Inventario</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Listas de precios por proveedor</h1>
      </div>

      <form className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm">
        <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
          <label className="text-sm font-medium text-gray-700">Proveedor</label>
          <select
            name="proveedorId"
            defaultValue={proveedorId ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-auto"
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

      {/* Mobile: tarjetas */}
      {proveedorId && (
        <ul className="space-y-2 md:hidden">
          {items.map((item) => {
            const costo = Number(item.precioConDescuento ?? item.precioCostoScraped);
            const margen = item.vinculado && item.precioVenta && costo > 0
              ? ((Number(item.precioVenta) - costo) / costo) * 100
              : null;
            return (
              <li key={item.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium text-gray-900">
                    {item.nombre}
                    {item.tamanios && <span className="font-normal text-gray-500"> · {item.tamanios}</span>}
                  </p>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">
                      {formatCurrency(item.precioConDescuento ?? item.precioCostoScraped)}
                    </p>
                    {item.precioConDescuento && (
                      <p className="text-xs text-gray-400 line-through">{formatCurrency(item.precioCostoScraped)}</p>
                    )}
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  <span className="font-mono">{item.sku}</span>
                  {item.skuInterno && <span className="font-mono text-blue-700"> · {item.skuInterno}</span>}
                  {item.tipoProducto && ` · ${item.tipoProducto}`}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
                  <span className="text-xs">
                    {!item.vinculado ? (
                      <span className="text-gray-400">Sin vincular</span>
                    ) : margen !== null ? (
                      <span className={margen >= 25 ? "font-medium text-green-600" : "font-medium text-orange-500"}>
                        Rentabilidad {margen.toFixed(1)}%
                      </span>
                    ) : null}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    {!item.vinculado && (
                      <Link
                        href={`/inventario/listas/${item.id}/crear-producto?proveedorId=${proveedorId}`}
                        className="rounded-md px-2 py-1 text-xs text-green-600 hover:bg-green-50"
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
                </div>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="py-6 text-center text-sm text-gray-400">
              Este proveedor no tiene una lista de precios importada.
            </li>
          )}
        </ul>
      )}

      {proveedorId && (
        <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">SKU proveedor</th>
                <th className="px-3 py-2">SKU Interno</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Tamaño</th>
                <th className="px-3 py-2 text-right">Precio lista</th>
                <th className="px-3 py-2 text-right">Precio c/dto</th>
                <th className="px-3 py-2 text-right">Rentabilidad</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{item.sku}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-blue-700">
                    {item.skuInterno ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2">{item.nombre}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {item.tipoProducto ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{item.tamanios ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatCurrency(item.precioCostoScraped)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {item.precioConDescuento ? formatCurrency(item.precioConDescuento) : "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {(() => {
                      if (!item.vinculado) return <span className="text-xs text-gray-300">sin vincular</span>;
                      if (!item.precioVenta) return <span className="text-gray-300">—</span>;
                      const costo = Number(item.precioConDescuento ?? item.precioCostoScraped);
                      const venta = Number(item.precioVenta);
                      if (costo === 0) return <span className="text-gray-300">—</span>;
                      const margen = ((venta - costo) / costo) * 100;
                      return (
                        <span className={margen >= 25 ? "font-medium text-green-600" : "font-medium text-orange-500"}>
                          {margen.toFixed(1)}%
                        </span>
                      );
                    })()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {!item.vinculado && (
                        <Link
                          href={`/inventario/listas/${item.id}/crear-producto?proveedorId=${proveedorId}`}
                          className="rounded-md px-2 py-1 text-xs text-green-600 hover:bg-green-50"
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
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-400">
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
