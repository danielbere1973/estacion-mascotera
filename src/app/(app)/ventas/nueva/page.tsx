import { prisma } from "@/lib/prisma";
import { crearVenta } from "../actions";
import { ClienteSelector } from "./cliente-selector";
import { VentaItems } from "./venta-items";

export default async function NuevaVentaPage() {
  const [clientes, productos, proveedores, comprasPorProducto, usuarios] = await Promise.all([
    prisma.cliente.findMany({ orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({
      where: { stockActual: { gt: 0 } },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        sku: true,
        nombre: true,
        precioVenta: true,
        stockActual: true,
      },
    }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.compra.findMany({
      select: { productoId: true, proveedorId: true },
      distinct: ["productoId", "proveedorId"],
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, apellido: true },
    }),
  ]);

  const proveedorIdsPorProducto = new Map<number, number[]>();
  for (const c of comprasPorProducto) {
    const lista = proveedorIdsPorProducto.get(c.productoId) ?? [];
    lista.push(c.proveedorId);
    proveedorIdsPorProducto.set(c.productoId, lista);
  }

  const productosPlain = productos.map((p) => ({
    ...p,
    precioVenta: p.precioVenta.toString(),
    proveedorIds: proveedorIdsPorProducto.get(p.id) ?? [],
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Nueva venta</h1>

      <form action={crearVenta} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <ClienteSelector clientes={clientes} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Canal de venta</label>
            <select
              name="canalVenta"
              required
              defaultValue=""
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Seleccionar...
              </option>
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
              placeholder="Transferencia, Efectivo, Mercado Pago..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Vendido por</label>
            <select
              name="vendidoPorId"
              defaultValue=""
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Sin especificar —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.apellido}, {u.nombre}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Cobrado por</label>
            <select
              name="cobradoPorId"
              defaultValue=""
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Sin especificar —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.apellido}, {u.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <VentaItems productos={productosPlain} proveedores={proveedores} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" name="facturado" className="h-4 w-4" />
              Facturado
            </label>
          </div>

          <div className="space-y-1 sm:col-span-2">
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
          Guardar venta
        </button>
      </form>
    </div>
  );
}
