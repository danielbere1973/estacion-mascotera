import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FiltrosVentas } from "./filtros-ventas";
import { VentaExpandibleRow } from "./venta-row";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    clienteId?: string;
    facturado?: string;
    canal?: string | string[];
    pago?: string | string[];
  }>;
}) {
  const params = await searchParams;

  const session = await auth();
  const esRestringido = session?.user?.rol === "LECTOR_RESTRINGIDO";

  const canalesSeleccionados = params.canal
    ? Array.isArray(params.canal) ? params.canal : [params.canal]
    : [];
  const pagosSeleccionados = params.pago
    ? Array.isArray(params.pago) ? params.pago : [params.pago]
    : [];

  const where: Record<string, unknown> = {};

  if (params.desde || params.hasta) {
    where.fechaVenta = {
      ...(params.desde ? { gte: new Date(params.desde) } : {}),
      ...(params.hasta ? { lt: new Date(`${params.hasta}T23:59:59`) } : {}),
    };
  }

  if (params.clienteId) where.clienteId = Number(params.clienteId);
  if (params.facturado === "si") where.facturado = true;
  if (params.facturado === "no") where.facturado = false;
  if (canalesSeleccionados.length > 0) where.canalVenta = { in: canalesSeleccionados };
  if (pagosSeleccionados.length > 0) where.medioPago = { in: pagosSeleccionados };

  if (esRestringido) {
    const comprasDelProveedor = await prisma.compra.findMany({
      where: { proveedorId: session?.user?.proveedorRestrictoId ?? -1 },
      select: { productoId: true },
      distinct: ["productoId"],
    });
    const productoIds = comprasDelProveedor.map((c) => c.productoId);
    where.detalles = { some: { productoId: { in: productoIds } } };
  }

  const [ventas, clientes, mediosPagoDistintos] = await Promise.all([
    prisma.venta.findMany({
      where,
      include: {
        cliente: {
          select: { nombre: true, apellido: true, cuit: true, dni: true },
        },

        detalles: {
          select: {
            id: true,
            cantidad: true,
            precioVentaUnitario: true,
            descuentoPorcentaje: true,
            precioCostoUnitario: true,
            producto: {
              select: { skuInterno: true, nombre: true, precioCostoUnitario: true },
            },
            ventaConsignacion: {
              select: {
                detalle: { select: { precioCosto: true, precioPiso: true } },
              },
            },
          },
        },
        costos: { select: { montoCalculado: true } },
      },
      orderBy: { fechaVenta: "desc" },
      take: 100,
    }),
    prisma.cliente.findMany({ orderBy: { nombre: "asc" } }),
    prisma.venta.findMany({
      select: { medioPago: true },
      distinct: ["medioPago"],
      orderBy: { medioPago: "asc" },
    }),
  ]);

  const mediosPago = mediosPagoDistintos.map((v) => v.medioPago);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Ventas</h1>
        {!esRestringido && (
          <Link
            href="/ventas/nueva"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Nueva venta
          </Link>
        )}
      </div>

      <FiltrosVentas
        desde={params.desde}
        hasta={params.hasta}
        clienteId={params.clienteId}
        facturado={params.facturado}
        canalesSeleccionados={canalesSeleccionados}
        pagosSeleccionados={pagosSeleccionados}
        clientes={clientes}
        mediosPago={mediosPago}
      />

      {(() => {
        const ventasNormales = ventas.filter((v) => !v.esVentaInterna);
        const ventasInternas = ventas.filter((v) => v.esVentaInterna);

        const renderTabla = (lista: typeof ventas, titulo?: string) => (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            {titulo && (
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{titulo}</span>
              </div>
            )}
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Total abonado</th>
                  {!esRestringido && <th className="px-3 py-2 text-right">Ganancia</th>}
                  <th className="px-3 py-2">Facturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lista.map((venta) => (
                  <VentaExpandibleRow
                    key={venta.id}
                    venta={{
                      ...venta,
                      costoEnvio: venta.costoEnvio.toString(),
                      detalles: venta.detalles.map((d) => ({
                        ...d,
                        precioVentaUnitario: d.precioVentaUnitario.toString(),
                        descuentoPorcentaje: d.descuentoPorcentaje.toString(),
                        precioCostoUnitario: d.precioCostoUnitario?.toString() ?? null,
                        producto: {
                          ...d.producto,
                          precioCostoUnitario: d.producto.precioCostoUnitario.toString(),
                        },
                        ventaConsignacion: d.ventaConsignacion
                          ? {
                              detalle: {
                                precioCosto: d.ventaConsignacion.detalle.precioCosto.toString(),
                                precioPiso: d.ventaConsignacion.detalle.precioPiso.toString(),
                              },
                            }
                          : null,
                      })),
                      costos: venta.costos.map((c) => ({
                        montoCalculado: c.montoCalculado.toString(),
                      })),
                    }}
                    esRestringido={esRestringido}
                  />
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={esRestringido ? 6 : 7} className="px-3 py-8 text-center text-gray-400">
                      No hay ventas registradas para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );

        return (
          <>
            {renderTabla(ventasNormales)}
            {ventasInternas.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-gray-400">Ventas internas</h2>
                {renderTabla(ventasInternas)}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
