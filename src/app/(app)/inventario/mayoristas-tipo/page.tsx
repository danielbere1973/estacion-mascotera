import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { perfilAcceso } from "@/lib/permissions";
import { TipoProductoMayorista } from "@prisma/client";
import { TablaMayoristas } from "./tabla-mayoristas";

const LABELS_TIPO: Record<TipoProductoMayorista, string> = {
  ALIMENTO_SECO: "Alimento seco",
  ALIMENTO_HUMEDO: "Alimento húmedo",
  SNACK: "Snack",
  PIEDRAS: "Piedras",
  ACCESORIOS: "Accesorios",
  OTROS: "Otros",
};

export default async function MayoristasTipoPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedor?: string; sinAsignar?: string; q?: string; tipoActual?: string }>;
}) {
  const { proveedor: proveedorFiltro, sinAsignar, q, tipoActual } = await searchParams;
  const soloSinAsignar = sinAsignar === "1";
  const { soloLectura } = await perfilAcceso(); // Solo lectura: ve el tipo sin poder cambiarlo.

  const [productos, proveedores] = await Promise.all([
    prisma.producto.findMany({
      where: {
        activo: true,
        ...(proveedorFiltro ? { historialStock: { some: { proveedorId: Number(proveedorFiltro), activo: true } } } : {}),
        ...(soloSinAsignar ? { tipoProductoMayorista: null } : {}),
        ...(tipoActual ? { tipoProductoMayorista: tipoActual as TipoProductoMayorista } : {}),
        ...(q ? {
          OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { marca: { contains: q, mode: "insensitive" } },
            { skuInterno: { contains: q, mode: "insensitive" } },
          ],
        } : {}),
      },
      select: {
        id: true,
        skuInterno: true,
        nombre: true,
        marca: true,
        categoria: true,
        tipoProductoMayorista: true,
      },
      orderBy: [{ marca: "asc" }, { nombre: "asc" }],
    }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/inventario" className="text-xs text-gray-400 hover:text-gray-600">← Inventario</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Asignar tipo de producto (mayorista)</h1>
        <p className="mt-1 text-sm text-gray-500">
          Define a qué categoría de margen mayorista pertenece cada producto (alimento seco, húmedo, snack, accesorios).
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Buscar</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nombre, marca o SKU..."
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Proveedor</label>
          <select name="proveedor" defaultValue={proveedorFiltro ?? ""} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Tipo actual</label>
          <select name="tipoActual" defaultValue={tipoActual ?? ""} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">Todos los tipos</option>
            {Object.entries(LABELS_TIPO).map(([valor, label]) => (
              <option key={valor} value={valor}>{label}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer select-none pb-1.5">
          <input type="checkbox" name="sinAsignar" value="1" defaultChecked={soloSinAsignar} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
          <span className="text-xs font-medium text-gray-600">Solo sin asignar</span>
        </label>
        <button type="submit" className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700">
          Filtrar
        </button>
      </form>

      <p className="text-xs text-gray-400">{productos.length} productos en este filtro</p>

      <TablaMayoristas productos={productos} soloLectura={soloLectura} />
    </div>
  );
}
