import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

export default async function ProveedorDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const proveedor = await prisma.proveedor.findUnique({
    where: { id: Number(id) },
    include: {
      historialMayorista: {
        where: { activo: true },
        include: { producto: { select: { id: true, nombre: true, marca: true, precioVenta: true, margenPorcentaje: true, activo: true } } },
        orderBy: { sku: "asc" },
      },
    },
  });

  if (!proveedor) notFound();

  const items = proveedor.historialMayorista;
  const conProducto = items.filter((h) => h.producto);
  const sinProducto = items.filter((h) => !h.producto);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/inventario/proveedores" className="text-xs text-gray-400 hover:text-gray-600">← Proveedores</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">{proveedor.nombre}</h1>
          {proveedor.contacto && <p className="text-sm text-gray-500">{proveedor.contacto}</p>}
        </div>
        <Link href={`/inventario/proveedores/${proveedor.id}/editar`} className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
          Editar
        </Link>
      </div>

      {/* Productos vinculados */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Productos vinculados <span className="text-gray-400">({conProducto.length})</span></p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">SKU proveedor</th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Marca</th>
              <th className="px-4 py-2 text-right">Precio costo</th>
              <th className="px-4 py-2 text-right">Precio venta</th>
              <th className="px-4 py-2 text-right">Margen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {conProducto.map((h) => {
              const costo = Number(h.precioConDescuento ?? h.precioCostoScraped);
              const venta = Number(h.producto!.precioVenta);
              const margen = costo > 0 ? ((venta - costo) / costo) * 100 : null;
              return (
                <tr key={h.id} className={h.producto?.activo === false ? "opacity-40" : "hover:bg-gray-50"}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-400">{h.sku}</td>
                  <td className="px-4 py-2">
                    <Link href={`/inventario/productos/${h.producto!.id}/editar`} className="text-blue-600 hover:underline">
                      {h.producto!.nombre}
                    </Link>
                    {h.producto?.activo === false && <span className="ml-2 text-xs text-gray-400">(inactivo)</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{h.producto!.marca}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(costo.toString())}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(venta.toString())}</td>
                  <td className="px-4 py-2 text-right">
                    {margen !== null
                      ? <span className={margen >= 25 ? "text-green-600 font-medium" : "text-orange-500 font-medium"}>
                          {margen.toFixed(1)}%
                        </span>
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {conProducto.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin productos vinculados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Items sin vincular */}
      {sinProducto.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700">Sin vincular al catálogo <span className="text-gray-400">({sinProducto.length})</span></p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Nombre en lista</th>
                <th className="px-4 py-2 text-right">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sinProducto.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-400">{h.sku}</td>
                  <td className="px-4 py-2 text-gray-600">{h.nombre ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-gray-500">
                    {formatCurrency(Number(h.precioConDescuento ?? h.precioCostoScraped).toString())}
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
