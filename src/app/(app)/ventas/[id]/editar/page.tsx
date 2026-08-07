import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarVenta } from "../../actions";
import { EditarVentaItems } from "./editar-venta-items";
import { CostosVenta } from "../../costos-venta";
import { FacturadoField } from "@/components/facturado-field";

export default async function EditarVentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [venta, productos, itemsConsignados] = await Promise.all([
    prisma.venta.findUnique({
      where: { id: Number(id) },
      include: {
        cliente: true,
        detalles: { include: { producto: { select: { skuInterno: true, nombre: true } } } },
        costos: true,
      },
    }),
    prisma.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, skuInterno: true, nombre: true, precioVenta: true, stockActual: true },
    }),
    prisma.detalleConsignacion.findMany({
      where: {
        productoId: { not: null },
        consignacion: { direccion: "RECIBIMOS", estado: "ABIERTA" },
      },
      include: { consignacion: { include: { socio: true } } },
    }),
  ]);

  if (!venta) notFound();

  const detalles = venta.detalles.map((d) => ({
    id: d.id,
    productoId: d.productoId,
    productoSku: d.producto.skuInterno,
    productoNombre: d.producto.nombre,
    cantidad: d.cantidad,
    precioVentaUnitario: d.precioVentaUnitario.toString(),
    descuentoPorcentaje: d.descuentoPorcentaje.toString(),
  }));

  const consignadosPorProducto = new Map<
    number,
    { detalleConsignacionId: number; consignacionId: number; socioNombre: string; disponible: number; precioPiso: string }[]
  >();
  for (const item of itemsConsignados) {
    const disponible = item.cantidad - item.cantidadVendida;
    if (disponible <= 0 || !item.productoId) continue;
    const lista = consignadosPorProducto.get(item.productoId) ?? [];
    lista.push({
      detalleConsignacionId: item.id,
      consignacionId: item.consignacionId,
      socioNombre: item.consignacion.socio.nombre,
      disponible,
      precioPiso: item.precioPiso.toString(),
    });
    consignadosPorProducto.set(item.productoId, lista);
  }

  const productosPlain = productos.map((p) => ({
    ...p,
    precioVenta: p.precioVenta.toString(),
    consignados: consignadosPorProducto.get(p.id) ?? [],
  }));

  const costosIniciales = venta.costos.map((c) => ({
    concepto: c.concepto,
    esPorcentaje: c.esPorcentaje,
    valor: c.valor.toString(),
    incluyeEnvio: c.incluyeEnvio,
  }));

  return (
    <div className="space-y-4">
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
            <label className="text-sm font-medium text-gray-700">Fecha de venta</label>
            <input
              type="date"
              name="fechaVenta"
              defaultValue={new Date(venta.fechaVenta).toISOString().split("T")[0]}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

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

        <EditarVentaItems detalles={detalles} productos={productosPlain} />

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

          <div className="sm:col-span-2">
            <FacturadoField defaultFacturado={venta.facturado} defaultNumero={venta.numeroFactura ?? ""} />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Fecha de acreditación (opcional)</label>
            <input
              type="date"
              name="fechaAcreditacion"
              defaultValue={venta.fechaAcreditacion ? new Date(venta.fechaAcreditacion).toISOString().split("T")[0] : ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <CostosVenta costosIniciales={costosIniciales} />

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
