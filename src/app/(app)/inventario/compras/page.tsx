import Link from "next/link";
import { perfilAcceso } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { eliminarCompra } from "../(inventario)/actions";
import { ComprasAgrupadas } from "./compras-agrupadas";

export default async function ComprasPage() {
  // restringido: solo compras de sus proveedores; sin botones de edición si es solo lectura o restringido.
  const { soloLectura, proveedores } = await perfilAcceso();
  const esRestringido = soloLectura || proveedores !== null;

  const compras = await prisma.compra.findMany({
    where: proveedores ? { proveedorId: { in: proveedores } } : undefined,
    include: { proveedor: true, producto: true },
    orderBy: { fechaCompra: "desc" },
    take: 200,
  });

  const comprasSerialized = compras.map((c) => ({
    id: c.id,
    fechaCompra: c.fechaCompra,
    cantidad: c.cantidad,
    precioCostoUnitario: c.precioCostoUnitario.toString(),
    descuentoPorcentaje: c.descuentoPorcentaje.toString(),
    costoEnvio: c.costoEnvio?.toString() ?? null,
    numeroPedido: c.numeroPedido,
    facturado: c.facturado,
    numeroFactura: c.numeroFactura,
    pagado: c.pagado,
    proveedor: { nombre: c.proveedor.nombre },
    producto: { sku: c.producto.skuInterno, nombre: c.producto.nombre },
  }));

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/inventario" className="text-xs text-gray-400 hover:text-gray-600">← Inventario</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Compras</h1>
        </div>
        {!esRestringido && (
          <Link
            href="/inventario/compra"
            className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Registrar compra
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-400 font-medium pl-11">
          <span>Fecha</span>
          <span>Proveedor</span>
          <span>N° Pedido</span>
          <span>Productos</span>
          <span className="text-right">Total · Estado</span>
        </div>
        <ComprasAgrupadas
          compras={comprasSerialized}
          esRestringido={esRestringido}
          accionEliminar={eliminarCompra}
        />
      </div>
    </div>
  );
}
