import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { precioMayoristaDe } from "@/lib/mayoristas";
import { traerDatosPorSkuTiendanube, type DatosTN } from "@/lib/tiendanube";
import { TipoProductoMayorista } from "@prisma/client";

const LABELS: Record<TipoProductoMayorista, string> = {
  ALIMENTO_SECO: "Alimento seco",
  ALIMENTO_HUMEDO: "Alimento húmedo",
  SNACK: "Snack",
  PIEDRAS: "Piedras",
  ACCESORIOS: "Accesorios",
  OTROS: "Otros",
};

export default async function MayoristasCatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  const { q, tipo: tipoFiltro } = await searchParams;

  const [productos, margenes, config] = await Promise.all([
    prisma.producto.findMany({
      where: {
        activo: true,
        tipoProductoMayorista: { not: null },
        historialStock: {
          some: {
            activo: true,
            OR: [
              { proveedor: { nombre: "HYM" }, estadoStockMayorista: { in: ["Stock disponible", "Poco Stock"] } },
              { proveedor: { nombre: { not: "HYM" } } },
            ],
          },
        },
        ...(tipoFiltro ? { tipoProductoMayorista: tipoFiltro as TipoProductoMayorista } : {}),
        ...(q ? {
          OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { nombreTiendanube: { contains: q, mode: "insensitive" } },
            { marca: { contains: q, mode: "insensitive" } },
            { skuInterno: { contains: q, mode: "insensitive" } },
          ],
        } : {}),
      },
      include: {
        historialStock: {
          where: { activo: true },
          select: { estadoStockMayorista: true, proveedor: { select: { nombre: true } } },
        },
      },
      orderBy: [{ tipoProductoMayorista: "asc" }, { nombre: "asc" }],
    }),
    prisma.margenMayorista.findMany(),
    prisma.tiendanubeConfig.findFirst(),
  ]);

  const margenesNum = margenes.map((m) => ({
    tipoProducto: m.tipoProducto,
    margenPorcentaje: Number(m.margenPorcentaje),
    margenPorcentajeTramo2: m.margenPorcentajeTramo2 != null ? Number(m.margenPorcentajeTramo2) : null,
    umbralKgTramo2: m.umbralKgTramo2 != null ? Number(m.umbralKgTramo2) : null,
  }));

  // Nombre y foto salen de Tiendanube (por SKU interno = SKU de la variante).
  let datosTN = new Map<string, DatosTN>();
  if (config) {
    try {
      datosTN = await traerDatosPorSkuTiendanube(config.storeId, config.accessToken);
    } catch {
      // Si falla Tiendanube (token vencido, etc.), seguimos con el nombre propio y sin fotos.
    }
  }

  const listado = productos.map((p) => {
    const tn = datosTN.get(p.skuInterno.toUpperCase());
    return {
      id: p.id,
      skuInterno: p.skuInterno,
      // Si el producto no está en Tiendanube, queda el nombre de la app.
      nombre: tn?.nombre ?? p.nombreTiendanube ?? p.nombre,
      marca: p.marca,
      estadoStock: p.historialStock.some((h) => h.proveedor?.nombre === "HYM")
        ? p.historialStock.some((h) => h.estadoStockMayorista === "Stock disponible")
          ? "Stock disponible"
          : "Poco Stock"
        : null,
      tipoProductoMayorista: p.tipoProductoMayorista as TipoProductoMayorista,
      precioMayorista: precioMayoristaDe(
        {
          tipoProductoMayorista: p.tipoProductoMayorista,
          contenido: Number(p.contenido),
          unidadMedida: p.unidadMedida,
          precioCostoUnitario: Number(p.precioCostoUnitario),
        },
        margenesNum
      ),
      foto: tn?.foto ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/inventario" className="text-xs text-gray-400 hover:text-gray-600">← Inventario</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Catálogo mayorista</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vista previa de precios mayoristas (costo + margen por tipo de producto). Muestra lo que tiene stock según el proveedor (igual que la tienda pública), no el stock propio.
        </p>
      </div>

      <form method="GET" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre, marca o SKU..."
          className="col-span-2 flex-1 min-w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          name="tipo"
          defaultValue={tipoFiltro ?? ""}
          className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(LABELS).map(([valor, label]) => (
            <option key={valor} value={valor}>{label}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          Buscar
        </button>
        {(q || tipoFiltro) && (
          <a href="/inventario/mayoristas-catalogo" className="rounded-md border border-gray-200 px-4 py-2 text-center text-sm text-gray-500 hover:bg-gray-50">
            Limpiar
          </a>
        )}
      </form>

      <p className="text-xs text-gray-400">{listado.length} producto{listado.length !== 1 ? "s" : ""}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {listado.map((p) => (
          <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-md bg-gray-100">
              {p.foto ? (
                <Image src={p.foto} alt={p.nombre} fill className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-400">Sin foto</div>
              )}
            </div>
            <p className="text-xs text-gray-400">{p.marca}</p>
            <p className="text-sm font-medium text-gray-900 leading-snug">{p.nombre}</p>
            <p className="mt-1 text-xs text-gray-400">{LABELS[p.tipoProductoMayorista]}</p>
            <p className="mt-2 text-lg font-semibold text-gray-900">
              {p.precioMayorista != null ? formatCurrency(p.precioMayorista) : "—"}
            </p>
            {p.estadoStock && (
              <p className={`text-xs ${p.estadoStock === "Stock disponible" ? "text-green-600" : "text-amber-600"}`}>
                {p.estadoStock}
              </p>
            )}
          </div>
        ))}
        {listado.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-gray-400">No hay productos que coincidan.</p>
        )}
      </div>
    </div>
  );
}
