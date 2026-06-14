import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatContenido } from "@/lib/format";
import { ImportarExcel } from "./importar-excel";

const STOCK_BAJO_UMBRAL = 5;

const CATEGORIA_LABELS: Record<string, string> = {
  ALIMENTO: "Alimento",
  POUCH: "Pouch",
  LATA: "Lata",
  SNACK: "Snack",
  GOLOSINA: "Golosina",
};

export default async function InventarioPage() {
  const [productos, proveedores] = await Promise.all([
    prisma.producto.findMany({
      orderBy: [{ stockActual: "asc" }, { nombre: "asc" }],
    }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const valorStockCosto = productos.reduce(
    (acc, p) => acc + p.stockActual * Number(p.precioCostoUnitario),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Inventario y Proveedores</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/inventario/listas"
            className="rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          >
            Listas de proveedores
          </Link>
          <Link
            href="/inventario/compras"
            className="rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          >
            Ver compras
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
        <p className="text-sm text-gray-500">Valor de stock (a costo)</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">
          {formatCurrency(valorStockCosto)}
        </p>
        <p className="mt-1 text-xs text-gray-400">Suma de costo unitario × stock actual de cada producto</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Importar lista de precios del mayorista (.xlsx / .csv)
        </h2>
        <ImportarExcel proveedores={proveedores} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Marca</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Contenido</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2 text-right">Costo</th>
              <th className="px-3 py-2 text-right">Margen</th>
              <th className="px-3 py-2 text-right">Valor total (costo)</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {productos.map((p) => {
              const bajoStock = p.stockActual <= STOCK_BAJO_UMBRAL;
              return (
                <tr key={p.id} className={bajoStock ? "bg-red-50" : "hover:bg-gray-50"}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{p.sku}</td>
                  <td className="px-3 py-2">{p.nombre}</td>
                  <td className="whitespace-nowrap px-3 py-2">{p.marca}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {CATEGORIA_LABELS[p.categoria] ?? p.categoria}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                    {formatContenido(p.contenido.toString(), p.unidadMedida)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 text-right font-medium ${
                      bajoStock ? "text-red-600" : ""
                    }`}
                  >
                    {p.stockActual}
                    {bajoStock && " ⚠"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatCurrency(p.precioCostoUnitario.toString())}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    +{p.margenPorcentaje.toString()}%
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                    {formatCurrency(p.stockActual * Number(p.precioCostoUnitario))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Link
                      href={`/inventario/productos/${p.id}/editar`}
                      className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {productos.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-gray-400">
                  No hay productos cargados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
