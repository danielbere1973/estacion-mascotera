import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarCompra } from "../../../actions";

export default async function EditarCompraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [compra, proveedores, productos] = await Promise.all([
    prisma.compra.findUnique({
      where: { id: Number(id) },
      include: { producto: true },
    }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({ orderBy: [{ marca: "asc" }, { nombre: "asc" }], select: { id: true, sku: true, nombre: true, marca: true } }),
  ]);

  if (!compra) notFound();

  const descuento = Number(compra.descuentoPorcentaje);
  const precioCosto = Number(compra.precioCostoUnitario);
  const precioListaUnitario = descuento < 100 ? precioCosto / (1 - descuento / 100) : precioCosto;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Editar compra #{compra.id}</h1>

      <form action={actualizarCompra} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="id" value={compra.id} />

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Producto</label>
          <select name="productoId" required defaultValue={compra.productoId}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} · {p.marca} {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Proveedor</label>
          <select name="proveedorId" required defaultValue={compra.proveedorId}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Cantidad</label>
            <input type="number" name="cantidad" min={1} required defaultValue={compra.cantidad}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Precio de costo (lista)</label>
            <input type="number" name="precioCostoUnitario" min={0} step="0.01" required
              defaultValue={precioListaUnitario}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Descuento del proveedor (%)</label>
            <input type="number" name="descuentoPorcentaje" min={0} max={100} step="0.01"
              defaultValue={compra.descuentoPorcentaje.toString()}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Costo de envío</label>
            <input type="number" name="costoEnvio" min={0} step="0.01"
              defaultValue={(compra.costoEnvio ?? 0).toString()}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">N° de pedido (opcional)</label>
            <input name="numeroPedido" defaultValue={compra.numeroPedido ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="flex items-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" name="facturado" defaultChecked={compra.facturado} className="h-4 w-4" />
              Facturado
            </label>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">N° de factura (opcional)</label>
            <input name="numeroFactura" defaultValue={compra.numeroFactura ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Si cambias el producto, el stock del producto original se revertirá y el nuevo producto recibirá las unidades.
        </p>

        <button type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
