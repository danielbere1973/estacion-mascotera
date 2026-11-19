import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { precioMayoristaDe } from "@/lib/mayoristas";
import { traerDatosPorSkuTiendanube, type DatosTN } from "@/lib/tiendanube";
import { TipoProductoMayorista } from "@prisma/client";
import { perfilAcceso } from "@/lib/permissions";
import { AgregarAlCarrito, BotonCarrito, CarritoProvider } from "./carrito";

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
  // El carrito crea ventas: solo para usuarios Administrador (Solo lectura ve el catálogo sin carrito).
  const { soloLectura } = await perfilAcceso();
  const puedeComprar = !soloLectura;

  const [productos, margenes, config, clientes, mediosPago] = await Promise.all([
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
    puedeComprar
      ? prisma.cliente.findMany({
          select: { id: true, nombre: true, apellido: true, dni: true },
          orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
        })
      : [],
    puedeComprar ? prisma.medioPago.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }) : [],
  ]);

  const opcionesClientes = clientes.map((c) => ({
    value: String(c.id),
    label: `${c.apellido}, ${c.nombre}`,
    search: `${c.nombre} ${c.apellido} ${c.dni ?? ""}`,
    hint: c.dni ? `DNI ${c.dni}` : undefined,
  }));

  const margenesNum = margenes.map((m) => ({
    tipoProducto: m.tipoProducto,
    margenPorcentaje: Number(m.margenPorcentaje),
    margenPorcentajeTramo2: m.margenPorcentajeTramo2 != null ? Number(m.margenPorcentajeTramo2) : null,
    umbralKgTramo2: m.umbralKgTramo2 != null ? Number(m.umbralKgTramo2) : null,
  }));

  // Nombre y foto salen de Tiendanube (por SKU interno = SKU de la variante).
  // Solo se muestran los productos que están en Tiendanube.
  let datosTN = new Map<string, DatosTN>();
  let errorTiendanube = !config;
  if (config) {
    try {
      datosTN = await traerDatosPorSkuTiendanube(config.storeId, config.accessToken);
    } catch {
      // Si falla Tiendanube (token vencido, etc.), avisamos en vez de romper la pantalla.
      errorTiendanube = true;
    }
  }

  const listado = productos.flatMap((p) => {
    const tn = datosTN.get(p.skuInterno.toUpperCase());
    if (!tn) return [];
    return {
      id: p.id,
      skuInterno: p.skuInterno,
      nombre: tn.nombre ?? p.nombreTiendanube ?? p.nombre,
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
      foto: tn.foto,
    };
  });

  return (
    <CarritoProvider>
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/inventario" className="text-xs text-gray-400 hover:text-gray-600">← Inventario</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Catálogo mayorista</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vista previa de precios mayoristas (costo + margen por tipo de producto). Muestra los productos publicados en Tiendanube que tienen stock según el proveedor (igual que la tienda pública), no el stock propio.
          </p>
        </div>
        {puedeComprar && <BotonCarrito clientes={opcionesClientes} mediosPago={mediosPago.map((m) => m.nombre)} />}
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

      {errorTiendanube && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No se pudo conectar con Tiendanube, por eso no se muestran productos. Probá de nuevo en un rato.
        </p>
      )}

      <p className="text-xs text-gray-400">{listado.length} producto{listado.length !== 1 ? "s" : ""}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {listado.map((p) => (
          <div key={p.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
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
            {puedeComprar && p.precioMayorista != null && (
              <div className="mt-auto">
                <AgregarAlCarrito
                  producto={{
                    productoId: p.id,
                    nombre: p.nombre,
                    marca: p.marca,
                    foto: p.foto,
                    precio: p.precioMayorista,
                  }}
                />
              </div>
            )}
          </div>
        ))}
        {listado.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-gray-400">No hay productos que coincidan.</p>
        )}
      </div>
    </div>
    </CarritoProvider>
  );
}
