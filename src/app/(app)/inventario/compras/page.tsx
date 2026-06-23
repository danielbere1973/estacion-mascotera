import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eliminarCompra } from "../actions";
import { ComprasAgrupadas } from "./compras-agrupadas";

export default async function ComprasPage() {
  const session = await auth();
  const esRestringido = session?.user?.rol === "LECTOR_RESTRINGIDO";

  const compras = await prisma.compra.findMany({
    where: esRestringido ? { proveedorId: session?.user?.proveedorRestrictoId ?? -1 } : undefined,
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
    proveedor: { nombre: c.proveedor.nombre },
    producto: { sku: c.producto.sku, nombre: c.producto.nombre },
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Compras</h1>
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-400 font-medium pl-11">
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
