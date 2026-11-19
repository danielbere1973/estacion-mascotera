import type { PedidoMayorista } from "@/lib/pedidos-mayoristas";
import { formatCurrency } from "@/lib/format";

// Hora de Argentina siempre (la página de admins se arma en el servidor, que está en UTC).
const formatoFecha = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

// Un pedido mayorista (carrito confirmado) desplegable: cabecera con número, fecha, estado
// y total; al abrirlo, el detalle de productos. Se usa en "Mis carritos" y en Mayorista > Carritos.
export function PedidoMayoristaItem({
  pedido,
  mostrarCliente = false,
  acciones,
}: {
  pedido: PedidoMayorista;
  mostrarCliente?: boolean;
  acciones?: React.ReactNode;
}) {
  const unidades = pedido.items.reduce((acc, i) => acc + i.cantidad, 0);

  return (
    <details className="group rounded-lg border border-gray-200 bg-white">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            Pedido #{pedido.id}
            <span className="ml-2 text-xs font-normal text-gray-400 group-open:hidden">▸ ver detalle</span>
            <span className="ml-2 hidden text-xs font-normal text-gray-400 group-open:inline">▾ ocultar</span>
          </p>
          {mostrarCliente && <p className="text-sm text-gray-700">{pedido.cliente}</p>}
          <p className="text-xs text-gray-500">
            {formatoFecha.format(new Date(pedido.fecha))} · {unidades} unidad{unidades !== 1 ? "es" : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-gray-900">{formatCurrency(pedido.total)}</p>
          {pedido.estado && (
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
              style={{ backgroundColor: pedido.colorEstado ?? "#6B7280" }}
            >
              {pedido.estado}
            </span>
          )}
        </div>
      </summary>

      <div className="space-y-2 border-t border-gray-100 p-3">
        <ul className="space-y-1">
          {pedido.items.map((i) => (
            <li key={i.productoId} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0 text-gray-700">
                {i.cantidad}× <span className="text-gray-400">{i.marca}</span> {i.nombre}
                <span className="block text-xs text-gray-400">{formatCurrency(i.precioUnitario)} c/u</span>
              </span>
              <span className="shrink-0 text-gray-600">{formatCurrency(i.subtotal)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-xs text-gray-500">
          <span>Medio de pago: {pedido.medioPago}</span>
          {pedido.comoNosConociste && <span>Cómo nos conoció: {pedido.comoNosConociste}</span>}
          <span>{pedido.cobrado ? "Cobrado" : "Pendiente de cobro"}</span>
        </div>
        {acciones && <div className="flex justify-end gap-2 pt-1">{acciones}</div>}
      </div>
    </details>
  );
}
