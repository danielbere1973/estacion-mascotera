import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { crearProductoDesdeListaMayorista } from "../../../actions";

export default async function CrearProductoDesdeListaPage({
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

  if (!item || item.productoId) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Crear producto desde lista</h1>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
        <p><span className="font-medium">SKU:</span> {item.sku}</p>
        <p><span className="font-medium">Nombre:</span> {item.nombre}</p>
        {item.tamanios && <p><span className="font-medium">Tamaño:</span> {item.tamanios}</p>}
        <p><span className="font-medium">Precio costo:</span> ${Number(item.precioCostoScraped).toLocaleString("es-AR")}</p>
      </div>

      <form action={crearProductoDesdeListaMayorista} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="listaItemId" value={item.id} />
        <input type="hidden" name="proveedorId" value={proveedorId ?? item.proveedorId ?? ""} />
        <input type="hidden" name="precioCostoUnitario" value={item.precioCostoScraped.toString()} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">SKU</label>
            <input
              name="sku"
              defaultValue={item.sku}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <input
              name="nombre"
              defaultValue={item.nombre ?? ""}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Marca</label>
            <input
              name="marca"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Categoría</label>
            <select
              name="categoria"
              required
              defaultValue=""
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>Seleccionar...</option>
              <option value="ALIMENTO">Alimento</option>
              <option value="POUCH">Pouch</option>
              <option value="LATA">Lata</option>
              <option value="SNACK">Snack</option>
              <option value="GOLOSINA">Golosina</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Presentación</label>
            <select
              name="presentacion"
              required
              defaultValue=""
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>Seleccionar...</option>
              <option value="BOLSA_CERRADA">Bolsa Cerrada</option>
              <option value="CAJA_CERRADA">Caja Cerrada</option>
              <option value="INDIVIDUAL">Individual</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Contenido</label>
            <input
              name="contenido"
              type="number"
              step="0.01"
              min={0}
              defaultValue="1"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Unidad de medida</label>
            <select
              name="unidadMedida"
              required
              defaultValue="UNIDAD"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="KILOGRAMOS">Kilogramos</option>
              <option value="GRAMOS">Gramos</option>
              <option value="LITROS">Litros</option>
              <option value="MILILITROS">Mililitros</option>
              <option value="UNIDAD">Unidad</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Margen sobre costo (%)</label>
            <input
              name="margenPorcentaje"
              type="number"
              step="0.01"
              min={0}
              defaultValue="30"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Crear producto
        </button>
      </form>
    </div>
  );
}
