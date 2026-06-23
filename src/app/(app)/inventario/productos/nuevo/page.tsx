import { prisma } from "@/lib/prisma";
import { crearProducto } from "../../actions";

export default async function NuevoProductoPage() {
  const [tipos, proveedores] = await Promise.all([
    prisma.tipoProducto.findMany({ orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Nuevo producto</h1>

      <form action={crearProducto} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Proveedor</label>
            <select name="proveedorId" defaultValue="" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="" disabled>Seleccionar proveedor...</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">SKU</label>
            <input name="sku" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <input name="nombre" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Marca</label>
            <input name="marca" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Categoría</label>
            <select name="categoria" required defaultValue="" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="" disabled>Seleccionar...</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.nombre}>{t.nombre}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Presentación</label>
            <select name="presentacion" required defaultValue="" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="" disabled>Seleccionar...</option>
              <option value="BOLSA_CERRADA">Bolsa Cerrada</option>
              <option value="CAJA_CERRADA">Caja Cerrada</option>
              <option value="INDIVIDUAL">Individual</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Unidad de medida</label>
            <select name="unidadMedida" required defaultValue="UNIDAD" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="KILOGRAMOS">Kilogramos</option>
              <option value="GRAMOS">Gramos</option>
              <option value="LITROS">Litros</option>
              <option value="MILILITROS">Mililitros</option>
              <option value="UNIDAD">Unidad</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Contenido</label>
            <input name="contenido" type="number" step="0.01" min={0} defaultValue={1} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Precio costo unitario</label>
            <input name="precioCostoUnitario" type="number" step="0.01" min={0} defaultValue={0} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Margen sobre costo (%)</label>
            <input name="margenPorcentaje" type="number" step="0.01" min={0} defaultValue={30} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Stock inicial</label>
            <input name="stockActual" type="number" min={0} defaultValue={0} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Crear producto
        </button>
      </form>
    </div>
  );
}
