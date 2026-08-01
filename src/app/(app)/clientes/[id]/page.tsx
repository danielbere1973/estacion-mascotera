import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function ClienteHistorialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const clienteId = Number(id);

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: {
      mascotas: true,
      productosRecurrentes: {
        where: { activo: true },
        include: { producto: { select: { nombre: true, marca: true } } },
      },
    },
  });

  if (!cliente) notFound();

  const ventas = await prisma.venta.findMany({
    where: { clienteId },
    include: {
      detalles: {
        include: { producto: { select: { nombre: true, marca: true, skuInterno: true } } },
      },
      costos: true,
    },
    orderBy: { fechaVenta: "desc" },
  });

  const totalGastado = ventas.reduce((acc, v) => {
    const total = v.detalles.reduce(
      (s, d) => s + d.cantidad * Number(d.precioVentaUnitario) * (1 - Number(d.descuentoPorcentaje) / 100),
      0
    );
    return acc + total - 0 + Number(v.costoEnvio);
  }, 0);

  const TAMANIO_LABELS: Record<string, string> = {
    MINI: "Mini",
    PEQUENIO: "Pequeño",
    MEDIANO: "Mediano",
    GRANDE: "Grande",
    GIGANTE: "Gigante",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {cliente.apellido}, {cliente.nombre}
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-500">
            <span>{cliente.telefono}</span>
            {cliente.email && <span>{cliente.email}</span>}
            <span>{cliente.direccion}</span>
          </div>
        </div>
        <Link
          href={`/clientes/${clienteId}/editar`}
          className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Editar
        </Link>
      </div>

      {/* Mascotas */}
      {cliente.mascotas.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">Mascotas</h2>
          <div className="flex flex-wrap gap-2">
            {cliente.mascotas.map((m) => (
              <div key={m.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                <span className="font-medium text-gray-800">{m.nombre}</span>
                <span className="ml-1.5 text-xs text-gray-500">
                  {m.tipo === "PERRO" ? "Perro" : "Gato"}
                  {m.raza ? ` · ${m.raza}` : ""}
                  {" · "}
                  {m.edad === "<1" ? "<1 año" : `${m.edad} ${m.edad === "1" ? "año" : "años"}`}
                  {" · "}{TAMANIO_LABELS[m.tamanio]}
                </span>
                {m.condicionesEspeciales && (
                  <div className="text-xs text-orange-600 mt-0.5">{m.condicionesEspeciales}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Productos recurrentes */}
      {cliente.productosRecurrentes.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">Productos recurrentes</h2>
          <div className="flex flex-wrap gap-2">
            {cliente.productosRecurrentes.map((r) => (
              <span key={r.id} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs text-blue-700">
                {r.producto.marca} {r.producto.nombre} · cada {r.periodoDias} días
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-gray-900">{ventas.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">compras totales</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalGastado)}</div>
          <div className="text-xs text-gray-500 mt-0.5">total gastado</div>
        </div>
        {ventas.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:col-span-1 col-span-2">
            <div className="text-2xl font-bold text-gray-900">{formatDate(ventas[0].fechaVenta)}</div>
            <div className="text-xs text-gray-500 mt-0.5">última compra</div>
          </div>
        )}
      </div>

      {/* Historial de ventas */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Historial de compras</h2>

        {ventas.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            Este cliente no tiene compras registradas.
          </div>
        )}

        {ventas.map((venta) => {
          const subtotal = venta.detalles.reduce(
            (acc, d) => acc + d.cantidad * Number(d.precioVentaUnitario),
            0
          );
          const descuento = venta.detalles.reduce(
            (acc, d) => acc + d.cantidad * Number(d.precioVentaUnitario) * (Number(d.descuentoPorcentaje) / 100),
            0
          );
          const total = subtotal - descuento + Number(venta.costoEnvio);

          return (
            <div key={venta.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{formatDate(venta.fechaVenta)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {venta.canalVenta === "TIENDANUBE" ? "Tiendanube" : venta.canalVenta === "WHATSAPP" ? "WhatsApp" : "Teléfono"}
                    {" · "}{venta.medioPago}
                    {venta.facturado && venta.numeroFactura && ` · Factura ${venta.numeroFactura}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-gray-900">{formatCurrency(total)}</div>
                  {descuento > 0 && (
                    <div className="text-xs text-gray-400">- {formatCurrency(descuento)} desc.</div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                {venta.detalles.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      {d.cantidad}× {d.producto.marca} {d.producto.nombre}
                    </span>
                    <span className="text-gray-500 shrink-0 ml-4">
                      {formatCurrency(d.cantidad * Number(d.precioVentaUnitario))}
                    </span>
                  </div>
                ))}
                {Number(venta.costoEnvio) > 0 && (
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>Envío</span>
                    <span>{formatCurrency(Number(venta.costoEnvio))}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Link
                  href={`/ventas/${venta.id}/editar`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Ver / editar venta
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
