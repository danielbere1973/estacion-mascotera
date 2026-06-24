import { prisma } from "@/lib/prisma";
import { crearVenta } from "../actions";
import { ClienteSelector } from "./cliente-selector";
import { VentaItems } from "./venta-items";
import { FacturadoField } from "@/components/facturado-field";

export default async function NuevaVentaPage() {
  const [clientes, productos, proveedores, comprasPorProducto, usuarios, mediosPago] = await Promise.all([
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
    prisma.medioPago.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
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
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Fecha de venta</label>
            <input
              type="date"
              name="fechaVenta"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

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
            <select
              name="medioPago"
              required
              defaultValue=""
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>Seleccionar...</option>
              {mediosPago.map((m) => (
                <option key={m.id} value={m.nombre}>{m.nombre}</option>
              ))}
            </select>
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

        <FacturadoField />

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
