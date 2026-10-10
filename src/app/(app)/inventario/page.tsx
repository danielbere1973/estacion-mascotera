import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { ImportarExcel } from "./importar-excel";
import { ImportarPlegable } from "./importar-plegable";
import { ProductoCard, ProductoRow, type ProductoListado } from "./producto-row";

const STOCK_BAJO_UMBRAL = 5;


export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; proveedor?: string; stockDistintoCero?: string }>;
}) {
  const { q, proveedor: proveedorFiltro, stockDistintoCero } = await searchParams;
  const filtroStockDistintoCero = stockDistintoCero === "1";

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
        ...(filtroStockDistintoCero ? { stockActual: { not: 0 } } : {}),
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

  const listado: ProductoListado[] = productos.map((p) => ({
    id: p.id,
    skuInterno: p.skuInterno,
    nombre: p.nombre,
    marca: p.marca,
    stockActual: p.stockActual,
    precioCostoUnitario: Number(p.precioCostoUnitario),
    precioVenta: Number(p.precioVenta),
    historialStock: p.historialStock.map((h) => ({
      id: h.id,
      sku: h.sku,
      precioCostoScraped: Number(h.precioCostoScraped),
      precioConDescuento: h.precioConDescuento !== null ? Number(h.precioConDescuento) : null,
      proveedor: h.proveedor,
    })),
  }));

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Inventario y Proveedores</h1>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Link
            href="/inventario/proveedores"
            className="rounded-md bg-white px-2 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 sm:px-4"
          >
            Proveedores
          </Link>
          <Link
            href="/inventario/tipos"
            className="rounded-md bg-white px-2 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 sm:px-4"
          >
            Tipos de producto
          </Link>
          <Link
            href="/inventario/listas"
            className="rounded-md bg-white px-2 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 sm:px-4"
          >
            Listas de proveedores
          </Link>
          <Link
            href="/inventario/vinculaciones"
            className="rounded-md bg-white px-2 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 sm:px-4"
          >
            Vinculaciones
          </Link>
          <Link
            href="/inventario/pendientes-hym"
            className="rounded-md bg-white px-2 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 sm:px-4"
          >
            Pendientes mayorista
          </Link>
          <Link
            href="/inventario/compras"
            className="rounded-md bg-white px-2 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 sm:px-4"
          >
            Ver compras
          </Link>
          <Link
            href="/inventario/productos/nuevo"
            className="order-first rounded-md bg-green-600 px-2 py-2 text-center text-sm font-semibold text-white hover:bg-green-700 sm:order-none sm:px-4"
          >
            + Nuevo producto
          </Link>
          <Link
            href="/inventario/compra"
            className="order-first rounded-md bg-blue-600 px-2 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700 sm:order-none sm:px-4"
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

      <ImportarPlegable titulo="Importar lista de precios del mayorista (.xlsx / .csv)">
        <ImportarExcel proveedores={proveedores} />
      </ImportarPlegable>

      {/* Buscador y filtro por proveedor */}
      <form method="GET" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre, marca o SKU..."
          className="col-span-2 flex-1 min-w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          name="proveedor"
          defaultValue={proveedorFiltro ?? ""}
          className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <label className="col-span-2 flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700">
          <input type="checkbox" name="stockDistintoCero" value="1" defaultChecked={filtroStockDistintoCero} />
          Stock distinto de 0
        </label>
        <button type="submit" className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          Buscar
        </button>
        {(q || proveedorFiltro || filtroStockDistintoCero) && (
          <a href="/inventario" className="rounded-md border border-gray-200 px-4 py-2 text-center text-sm text-gray-500 hover:bg-gray-50">
            Limpiar
          </a>
        )}
      </form>

      <p className="text-xs text-gray-400">{productos.length} producto{productos.length !== 1 ? "s" : ""}</p>

      {/* Mobile: tarjetas */}
      <ul className="space-y-2 md:hidden">
        {listado.map((p) => (
          <ProductoCard key={p.id} p={p} />
        ))}
        {listado.length === 0 && (
          <li className="py-6 text-center text-sm text-gray-400">No hay productos que coincidan con la búsqueda.</li>
        )}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 w-20">SKU</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2 w-32">Marca</th>
              <th className="px-3 py-2 w-40">Proveedores</th>
              <th className="px-3 py-2 w-32">Cód. proveedor</th>
              <th className="px-3 py-2 w-16 text-right">Stock</th>
              <th className="px-3 py-2 text-right">Costo</th>
              <th className="px-3 py-2 text-right">Precio Lista</th>
              <th className="px-3 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {listado.map((p) => (
              <ProductoRow key={p.id} p={p} />
            ))}
            {productos.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-400">
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
