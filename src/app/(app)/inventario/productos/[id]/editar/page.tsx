import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarProducto } from "../../../actions";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const producto = await prisma.producto.findUnique({ where: { id: Number(id) } });
  if (!producto) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Editar producto</h1>

      <form action={actualizarProducto} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="id" value={producto.id} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">SKU</label>
            <input
              name="sku"
              defaultValue={producto.sku}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <input
              name="nombre"
              defaultValue={producto.nombre}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Marca</label>
            <input
              name="marca"
              defaultValue={producto.marca}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Categoría</label>
            <select
              name="categoria"
              defaultValue={producto.categoria}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
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
              defaultValue={producto.presentacion}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
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
              defaultValue={producto.contenido.toString()}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Unidad de medida</label>
            <select
              name="unidadMedida"
              defaultValue={producto.unidadMedida}
              required
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
              defaultValue={producto.margenPorcentaje.toString()}
              required
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
