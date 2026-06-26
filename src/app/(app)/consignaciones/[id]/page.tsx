import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { registrarVentaConsignacion, cerrarConsignacion, registrarPagoConsignacion, eliminarPagoConsignacion } from "../actions";
import { FacturadoField } from "@/components/facturado-field";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { VentaRow } from "./venta-row";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export default async function DetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cons = await prisma.consignacion.findUnique({
    where: { id: Number(id) },
    include: {
      socio: true,
      pagos: { orderBy: { fecha: "asc" } },
      items: {
        include: {
          producto: { select: { nombre: true, marca: true } },
          ventas: { orderBy: { fecha: "desc" } },
        },
      },
      liquidacion: true,
    },
  });
  if (!cons) notFound();

  const esEntregamos = cons.direccion === "ENTREGAMOS";
  const totalVendido = cons.items.reduce((s, it) => s + it.cantidadVendida, 0);

  // Monto total a liquidar: costo + 1/3 ganancia por cada venta
  const montoLiquidar = cons.items.reduce((s, it) => {
    const costo = Number(it.precioCosto);
    return s + it.ventas.reduce((sv, v) => {
      const ganancia = Number(v.precioVentaReal) - costo;
      return sv + (costo + ganancia / 3) * v.cantidad;
    }, 0);
  }, 0);

  const totalPagado = cons.pagos.reduce((s, p) => s + Number(p.monto), 0);
  const pendiente = montoLiquidar - totalPagado;
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/consignaciones" className="text-xs text-gray-400 hover:text-gray-600">← Consignaciones</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">
            {esEntregamos ? "Entrega a" : "Recepción de"} {cons.socio.nombre}
          </h1>
          <p className="text-sm text-gray-400">
            {new Date(cons.fecha).toLocaleDateString("es-AR")} · #{cons.id}
            {" · "}
            <span className={cons.estado === "ABIERTA" ? "text-green-600" : "text-gray-500"}>
              {cons.estado === "ABIERTA" ? "Abierta" : "Cerrada"}
            </span>
          </p>
        </div>
        {cons.estado === "ABIERTA" && (
          <form action={cerrarConsignacion}>
            <input type="hidden" name="id" value={cons.id} />
            <ConfirmSubmitButton
              confirmMessage="¿Cerrar esta consignación?"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              Cerrar consignación
            </ConfirmSubmitButton>
          </form>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-400">Unidades entregadas</p>
          <p className="text-lg font-semibold text-gray-900">{cons.items.reduce((s, it) => s + it.cantidad, 0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-400">Unidades vendidas</p>
          <p className="text-lg font-semibold text-gray-900">{totalVendido}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-400">{esEntregamos ? "A cobrar" : "A pagar"} (costo + 1/3 ganancia)</p>
          <p className="text-lg font-semibold text-blue-700">{fmt(montoLiquidar)}</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${pendiente <= 0 ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
          <p className="text-xs text-gray-400">Pendiente de pago</p>
          <p className={`text-lg font-semibold ${pendiente <= 0 ? "text-green-700" : "text-orange-600"}`}>
            {pendiente <= 0 ? "Saldado ✓" : fmt(pendiente)}
          </p>
          {totalPagado > 0 && <p className="text-xs text-gray-400">Pagado: {fmt(totalPagado)}</p>}
        </div>
      </div>

      {/* Pagos */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Pagos</h2>
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {cons.pagos.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <span className="text-sm font-medium text-gray-900">{fmt(Number(p.monto))}</span>
                <span className="text-xs text-gray-400 ml-2">{new Date(p.fecha).toLocaleDateString("es-AR")}</span>
                {p.notas && <span className="text-xs text-gray-400 ml-2">· {p.notas}</span>}
              </div>
              <form action={eliminarPagoConsignacion}>
                <input type="hidden" name="id" value={p.id} />
                <ConfirmSubmitButton
                  confirmMessage={`¿Eliminar pago de ${fmt(Number(p.monto))}?`}
                  className="text-xs text-red-400 hover:text-red-600">
                  Eliminar
                </ConfirmSubmitButton>
              </form>
            </div>
          ))}
          {cons.pagos.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400 text-center">Sin pagos registrados.</p>
          )}
        </div>

        {/* Formulario nuevo pago */}
        {montoLiquidar > 0 && pendiente > 0 && (
          <form action={registrarPagoConsignacion} className="rounded-xl border border-blue-100 bg-blue-50 p-3 flex gap-3 items-end flex-wrap">
            <input type="hidden" name="consignacionId" value={cons.id} />
            <div>
              <label className="text-xs text-blue-700">Fecha</label>
              <input name="fecha" type="date" defaultValue={today}
                className="block rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-blue-700">Monto</label>
              <input name="monto" type="number" min={0.01} step={0.01} defaultValue={pendiente.toFixed(2)}
                className="block w-36 rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm" />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs text-blue-700">Notas (opcional)</label>
              <input name="notas" placeholder="Transferencia, efectivo..."
                className="block w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm" />
            </div>
            <button type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap">
              Registrar pago
            </button>
          </form>
        )}
      </div>

      {/* Items */}
      <div className="space-y-3">
        {cons.items.map((item) => {
          const disponible = item.cantidad - item.cantidadVendida;
          const montoItem = item.ventas.reduce((s, v) => s + Number(v.precioVentaReal) * v.cantidad, 0);
          const montoEsperado = Number(item.precioPiso) * item.cantidadVendida;
          const diff = montoItem - montoEsperado;
          return (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-sm text-gray-900">
                    {item.producto ? `${item.producto.nombre} (${item.producto.marca})` : item.descripcion ?? "Sin descripción"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Costo: {fmt(Number(item.precioCosto))} · Piso: {fmt(Number(item.precioPiso))} · Cant: {item.cantidad} · Disponibles: {disponible}
                  </p>
                </div>
                {diff !== 0 && (
                  <span className={`text-xs font-semibold ${diff > 0 ? "text-green-600" : "text-red-600"}`}>
                    {diff > 0 ? "+" : ""}{fmt(diff)} vs piso
                  </span>
                )}
              </div>

              {/* Registrar venta */}
              {disponible > 0 && cons.estado === "ABIERTA" && (
                <form action={registrarVentaConsignacion} className="space-y-2 mb-3">
                  <input type="hidden" name="detalleId" value={item.id} />
                  <div className="flex gap-2 items-end flex-wrap">
                    <div>
                      <label className="text-xs text-gray-400">Cant. vendida</label>
                      <input name="cantidad" type="number" min={1} max={disponible} defaultValue={1}
                        className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Precio de venta</label>
                      <input name="precioVentaReal" type="number" min={0} step={0.01} defaultValue={Number(item.precioPiso)}
                        className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <button type="submit"
                      className="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700">
                      Registrar venta
                    </button>
                  </div>
                  <FacturadoField />
                </form>
              )}

              {/* Historial de ventas */}
              {item.ventas.length > 0 && (
                <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Ventas registradas</p>
                  {item.ventas.map((v) => (
                    <VentaRow key={v.id} venta={{
                      id: v.id,
                      fecha: v.fecha,
                      cantidad: v.cantidad,
                      precioVentaReal: Number(v.precioVentaReal),
                      precioCosto: Number(item.precioCosto),
                      liquidacionId: v.liquidacionId,
                      facturado: v.facturado,
                      numeroFactura: v.numeroFactura,
                      maxCantidad: item.cantidad,
                    }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {cons.notas && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-100 px-3 py-2 text-sm text-yellow-800">
          {cons.notas}
        </div>
      )}
    </div>
  );
}
