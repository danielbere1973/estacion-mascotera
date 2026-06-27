import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditorCompraForm } from "./editar-compra-form";

export default async function EditarCompraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [compra, proveedores, mayoristaItems] = await Promise.all([
    prisma.compra.findUnique({
      where: { id: Number(id) },
      include: { producto: { select: { id: true, sku: true, nombre: true } } },
    }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.historialStockMayorista.findMany({
      where: { productoId: { not: null } },
      orderBy: [{ proveedorId: "asc" }, { nombre: "asc" }],
      select: {
        proveedorId: true,
        sku: true,
        nombre: true,
        tamanios: true,
        precioCostoScraped: true,
        precioConDescuento: true,
        productoId: true,
        producto: { select: { sku: true } },
      },
      distinct: ["proveedorId", "sku"],
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
        mayoristaItems={mayoristaItems.map((i) => ({
          proveedorId: i.proveedorId ?? 0,
          sku: i.sku,
          nombre: i.nombre ?? null,
          tamanios: i.tamanios ?? null,
          precioCostoScraped: i.precioCostoScraped.toString(),
          precioConDescuento: i.precioConDescuento?.toString() ?? null,
          productoId: i.productoId,
          productoSku: i.producto?.sku ?? null,
        }))}
      />
    </div>
  );
}
