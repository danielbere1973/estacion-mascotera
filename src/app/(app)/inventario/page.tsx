import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { ImportarExcel } from "./importar-excel";
import { ProductoRow } from "./producto-row";

const STOCK_BAJO_UMBRAL = 5;


export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; proveedor?: string }>;
}) {
  const { q, proveedor: proveedorFiltro } = await searchParams;

  const [productos, proveedores] = await Promise.all([
    prisma.producto.findMany({
      where: {
        activo: true,
        ...(q ? {
          OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { marca: { contains: q, mode: "insensitive" } },
            { skuInterno: { contains: q, mode: "insensitive" } },
            { skuInterno: { contains: q, mode: "insensitive" } },
          ],
        } : {}),
        ...(proveedorFiltro ? {
          historialStock: { some: { proveedorId: Number(proveedorFiltro), activo: true } },
        } : {}),
      },
      include: {
        historialStock: {
          where: { activo: true },
          include: { proveedor: { select: { nombre: true } } },
        },
      },
      orderBy: [{ marca: "asc" }, { nombre: "asc" }],
    }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const valorStockLista = productos.reduce(
    (acc, p) => acc + p.stockActual * Number(p.precioVenta),
    0
  );

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Inventario y Proveedores</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/inventario/proveedores"
            className="rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          >
            Proveedores
          </Link>
          <Link
            href="/inventario/tipos"
            className="rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          >
            Tipos de producto
          </Link>
          <Link
            href="/inventario/listas"
            className="rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          >
            Listas de proveedores
          </Link>
          <Link
            href="/inventario/vinculaciones"
            className="rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          >
            Vinculaciones
          </Link>
          <Link
            href="/inventario/compras"
            className="rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          >
            Ver compras
          </Link>
          <Link
            href="/inventario/productos/nuevo"
            className="rounded-md bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-green-700"
          >
            + Nuevo producto
          </Link>
          <Link
            href="/inventario/compra"
            className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Registrar compra
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">Valor de stock (precio de lista)</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">
          {formatCurrency(valorStockLista)}
        </p>
        <p className="mt-1 text-xs text-gray-400">Suma de precio de venta × stock actual de cada producto</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Importar lista de precios del mayorista (.xlsx / .csv)
        </h2>
        <ImportarExcel proveedores={proveedores} />
      </div>

      {/* Buscador y filtro por proveedor */}
      <form method="GET" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre, marca o SKU..."
          className="flex-1 min-w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          name="proveedor"
          defaultValue={proveedorFiltro ?? ""}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          Buscar
        </button>
        {(q || proveedorFiltro) && (
          <a href="/inventario" className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">
            Limpiar
          </a>
        )}
      </form>

      <p className="text-xs text-gray-400">{productos.length} producto{productos.length !== 1 ? "s" : ""}</p>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 w-20">SKU</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2 w-32">Marca</th>
              <th className="px-3 py-2 w-40">Proveedores</th>
              <th className="px-3 py-2 w-16 text-right">Stock</th>
              <th className="px-3 py-2 text-right">Costo</th>
              <th className="px-3 py-2 text-right">Precio Lista</th>
              <th className="px-3 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {productos.map((p) => (
              <ProductoRow key={p.id} p={{
                ...p,
                precioCostoUnitario: Number(p.precioCostoUnitario),
                precioVenta: Number(p.precioVenta),
                historialStock: p.historialStock.map((h) => ({
                  ...h,
                  precioCostoScraped: Number(h.precioCostoScraped),
                  precioConDescuento: h.precioConDescuento !== null ? Number(h.precioConDescuento) : null,
                })),
              }} />
            ))}
            {productos.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  No hay productos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
