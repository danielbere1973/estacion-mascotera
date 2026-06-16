import { prisma } from "@/lib/prisma";
import { crearCompra } from "../actions";
import { CompraForm } from "./compra-form";
import type { MayoristaItem } from "./mayorista-producto-selector";

export default async function NuevaCompraPage() {
  const [proveedores, productos, historial, tiposProducto] = await Promise.all([
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, sku: true, nombre: true },
    }),
    prisma.historialStockMayorista.findMany({
      where: { proveedorId: { not: null } },
      orderBy: { fechaImportacion: "desc" },
      include: { producto: { select: { sku: true } } },
    }),
    prisma.tipoProducto.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  // Última lista importada por proveedor: nos quedamos con el registro más
  // reciente de cada combinación proveedor + sku.
  const vistos = new Set<string>();
  const mayoristaItems: MayoristaItem[] = [];
  for (const h of historial) {
    const clave = `${h.proveedorId}-${h.sku}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    mayoristaItems.push({
      proveedorId: h.proveedorId as number,
      sku: h.sku,
      nombre: h.nombre,
      precioCostoScraped: h.precioCostoScraped.toString(),
      precioConDescuento: h.precioConDescuento?.toString() ?? null,
      tamanios: h.tamanios,
      productoId: h.productoId,
      productoSku: h.producto?.sku ?? null,
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Registrar compra</h1>
      <CompraForm
        proveedores={proveedores}
        productos={productos}
        mayoristaItems={mayoristaItems}
        tiposProducto={tiposProducto}
        action={crearCompra}
      />
    </div>
  );
}
