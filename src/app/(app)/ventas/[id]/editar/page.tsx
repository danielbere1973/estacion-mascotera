import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarVenta } from "../../actions";
import { EditarVentaItems } from "./editar-venta-items";

export default async function EditarVentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const venta = await prisma.venta.findUnique({
    where: { id: Number(id) },
    include: {
      cliente: true,
      detalles: { include: { producto: true } },
    },
  });

  if (!venta) notFound();

  const detalles = venta.detalles.map((d) => ({
    id: d.id,
    productoId: d.productoId,
    productoSku: d.producto.sku,
    productoNombre: d.producto.nombre,
    cantidad: d.cantidad,
    precioVentaUnitario: d.precioVentaUnitario.toString(),
    descuentoPorcentaje: d.descuentoPorcentaje.toString(),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Editar venta</h1>

      <form action={actualizarVenta} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="id" value={venta.id} />

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Cliente</label>
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {venta.cliente.nombre} {venta.cliente.apellido}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Canal de venta</label>
            <select
              name="canalVenta"
              required
              defaultValue={venta.canalVenta}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="TIENDANUBE">Tiendanube</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="TELEFONO">Teléfono</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Medio de pago</label>
            <input
              name="medioPago"
              required
              defaultValue={venta.medioPago}
              placeholder="Transferencia, Efectivo, Mercado Pago..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <EditarVentaItems detalles={detalles} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Costo de envío</label>
            <input
              type="number"
              name="costoEnvio"
              min={0}
              step="0.01"
              defaultValue={venta.costoEnvio.toString()}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" name="facturado" defaultChecked={venta.facturado} className="h-4 w-4" />
              Facturado
            </label>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">N° de factura (opcional)</label>
            <input
              name="numeroFactura"
              defaultValue={venta.numeroFactura ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
