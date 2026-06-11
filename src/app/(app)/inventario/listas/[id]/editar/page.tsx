import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarItemMayorista } from "../../../actions";

export default async function EditarItemMayoristaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ proveedorId?: string }>;
}) {
  const { id } = await params;
  const { proveedorId } = await searchParams;

  const item = await prisma.historialStockMayorista.findUnique({
    where: { id: Number(id) },
  });

  if (!item) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Editar item de la lista</h1>

      <form action={actualizarItemMayorista} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="proveedorId" value={proveedorId ?? item.proveedorId ?? ""} />

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">SKU del proveedor</label>
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-700">
            {item.sku}
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Nombre</label>
          <input
            name="nombre"
            defaultValue={item.nombre ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Tamaño</label>
          <input
            name="tamanios"
            defaultValue={item.tamanios ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Precio Lista</label>
            <input
              type="number"
              name="precioCostoScraped"
              min={0}
              step="0.01"
              required
              defaultValue={item.precioCostoScraped.toString()}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Precio c/dto (opcional)</label>
            <input
              type="number"
              name="precioConDescuento"
              min={0}
              step="0.01"
              defaultValue={item.precioConDescuento?.toString() ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
