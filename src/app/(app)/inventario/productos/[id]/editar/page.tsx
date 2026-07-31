import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarProducto } from "../../../actions";
import { agregarProveedorProducto, quitarProveedorProducto } from "./actions";
import { AgregarProveedorForm } from "./agregar-proveedor-form";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [producto, tipos, proveedores, itemsPorProveedor] = await Promise.all([
    prisma.producto.findUnique({
      where: { id: Number(id) },
      include: {
        historialStock: {
          where: { activo: true },
          include: { proveedor: { select: { id: true, nombre: true } } },
          orderBy: { proveedor: { nombre: "asc" } },
        },
      },
    }),
    prisma.tipoProducto.findMany({ orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.historialStockMayorista.findMany({
      where: { activo: true },
      select: {
        proveedorId: true,
        sku: true,
        nombre: true,
        precioCostoScraped: true,
        precioConDescuento: true,
      },
      orderBy: { sku: "asc" },
    }),
  ]);
  if (!producto) notFound();

  const proveedoresYaVinculados = new Set(producto.historialStock.map((h) => h.proveedorId).filter(Boolean) as number[]);
  const proveedoresDisponibles = proveedores.filter((p) => !proveedoresYaVinculados.has(p.id));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Editar producto</h1>

      <form action={actualizarProducto} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="id" value={producto.id} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">SKU proveedor principal</label>
            <input name="sku" defaultValue={producto.sku} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">SKU interno <span className="font-normal text-gray-400">(para ARCA)</span></label>
            <input name="skuInterno" defaultValue={producto.skuInterno ?? ""} placeholder="AA00" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <input name="nombre" defaultValue={producto.nombre} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Marca</label>
            <input name="marca" defaultValue={producto.marca} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Categoría</label>
            <select name="categoria" defaultValue={producto.categoria} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {tipos.map((t) => (
                <option key={t.id} value={t.nombre}>{t.nombre}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Presentación</label>
            <select name="presentacion" defaultValue={producto.presentacion} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="BOLSA_CERRADA">Bolsa Cerrada</option>
              <option value="CAJA_CERRADA">Caja Cerrada</option>
              <option value="INDIVIDUAL">Individual</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Contenido</label>
            <input name="contenido" type="number" step="0.01" min={0} defaultValue={producto.contenido.toString()} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Unidad de medida</label>
            <select name="unidadMedida" defaultValue={producto.unidadMedida} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="KILOGRAMOS">Kilogramos</option>
              <option value="GRAMOS">Gramos</option>
              <option value="LITROS">Litros</option>
              <option value="MILILITROS">Mililitros</option>
              <option value="UNIDAD">Unidad</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Precio costo unitario</label>
            <input name="precioCostoUnitario" type="number" step="0.01" min={0} defaultValue={producto.precioCostoUnitario.toString()} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Margen sobre costo (%)</label>
            <input name="margenPorcentaje" type="number" step="0.01" min={0} defaultValue={producto.margenPorcentaje.toString()} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Guardar cambios
        </button>
      </form>

      {/* Proveedores */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Proveedores</h2>

        {producto.historialStock.length > 0 && (
          <div className="space-y-2">
            {producto.historialStock.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-gray-800">{h.proveedor?.nombre ?? "—"}</span>
                  <span className="ml-3 text-gray-500 font-mono text-xs">{h.sku}</span>
                  <span className="ml-3 text-gray-600">
                    ${Number(h.precioConDescuento ?? h.precioCostoScraped).toLocaleString("es-AR")}
                  </span>
                </div>
                <form action={quitarProveedorProducto}>
                  <input type="hidden" name="historialId" value={h.id} />
                  <input type="hidden" name="productoId" value={producto.id} />
                  <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                    Quitar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        {proveedoresDisponibles.length > 0 && (
          <AgregarProveedorForm
            productoId={producto.id}
            proveedores={proveedoresDisponibles}
            itemsPorProveedor={itemsPorProveedor
              .filter((i) => i.proveedorId !== null)
              .map((i) => ({
                proveedorId: i.proveedorId!,
                sku: i.sku,
                nombre: i.nombre ?? "",
                precio: Number(i.precioConDescuento ?? i.precioCostoScraped),
              }))}
            action={agregarProveedorProducto}
          />
        )}
      </div>
    </div>
  );
}
