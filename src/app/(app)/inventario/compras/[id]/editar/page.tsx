import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditorCompraForm } from "./editar-compra-form";

export default async function EditarCompraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [compra, proveedores, productos] = await Promise.all([
    prisma.compra.findUnique({
      where: { id: Number(id) },
      include: { producto: { select: { id: true, sku: true, nombre: true } } },
    }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({
      orderBy: [{ marca: "asc" }, { nombre: "asc" }],
      select: { id: true, sku: true, nombre: true, marca: true },
    }),
  ]);

  if (!compra) notFound();

  const descuento = Number(compra.descuentoPorcentaje);
  const precioCosto = Number(compra.precioCostoUnitario);
  const precioListaUnitario = descuento < 100 ? precioCosto / (1 - descuento / 100) : precioCosto;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Editar compra #{compra.id}</h1>
      <EditorCompraForm
        compra={{
          id: compra.id,
          productoId: compra.productoId,
          productoSku: compra.producto.sku,
          productoNombre: compra.producto.nombre,
          proveedorId: compra.proveedorId,
          cantidad: compra.cantidad,
          precioListaUnitario,
          descuentoPorcentaje: compra.descuentoPorcentaje.toString(),
          costoEnvio: (compra.costoEnvio ?? 0).toString(),
          numeroPedido: compra.numeroPedido,
          facturado: compra.facturado,
          numeroFactura: compra.numeroFactura,
        }}
        proveedores={proveedores}
        productos={productos}
      />
    </div>
  );
}
