import { prisma } from "@/lib/prisma";
import { crearCompra } from "../actions";
import { ProveedorSelector } from "./proveedor-selector";
import { ProductoSelector } from "./producto-selector";

export default async function NuevaCompraPage() {
  const [proveedores, productos] = await Promise.all([
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, sku: true, nombre: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Registrar compra</h1>

      <form action={crearCompra} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <ProveedorSelector proveedores={proveedores} />
        <ProductoSelector productos={productos} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Cantidad</label>
            <input
              type="number"
              name="cantidad"
              min={1}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Precio de costo unitario</label>
            <input
              type="number"
              name="precioCostoUnitario"
              min={0}
              step="0.01"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Costo de envío</label>
            <input
              type="number"
              name="costoEnvio"
              min={0}
              step="0.01"
              defaultValue={0}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">N° de pedido (opcional)</label>
            <input
              name="numeroPedido"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" name="facturado" className="h-4 w-4" />
              Facturado
            </label>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">N° de factura (opcional)</label>
            <input
              name="numeroFactura"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Guardar compra
        </button>
      </form>
    </div>
  );
}
