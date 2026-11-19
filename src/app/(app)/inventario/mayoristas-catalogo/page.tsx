import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { precioMayoristaDe } from "@/lib/mayoristas";
import type { CategoriaTN, DatosTN } from "@/lib/tiendanube";
import { traerCategoriasTiendanubeCacheado, traerDatosPorSkuTiendanubeCacheado } from "@/lib/tiendanube-cache";
import { TipoProductoMayorista } from "@prisma/client";
import { perfilAcceso } from "@/lib/permissions";
import { BotonCarrito, CarritoProvider } from "./carrito";
import { BotonMisCarritos } from "./mis-carritos";
import { estadoStockDe } from "./limites";
import { COMPRA_MINIMA_TEXTO } from "./opciones";
import { armarArbolCategorias } from "./arbol-categorias";
import { CatalogoProductos, ExtrasBusqueda, type ProductoCatalogo } from "./catalogo-productos";

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
  // ?cat= (categoría del árbol) también viene en la URL, pero se filtra en el navegador.
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  const { q, tipo: tipoFiltro } = await searchParams;
  // El carrito crea ventas: lo usan los Administradores (eligen el cliente) y los usuarios
  // vinculados a un cliente (compran a su nombre y ven "Mis carritos"). El resto ve el catálogo sin carrito.
  const { esAdmin, clienteId: clienteVinculadoId } = await perfilAcceso();
  const puedeComprar = esAdmin || clienteVinculadoId != null;
  // Un usuario vinculado no recibe la lista de clientes: solo el suyo.
  const eligeCliente = esAdmin && clienteVinculadoId == null;

  const [productos, margenes, config, clientes, clienteVinculado] = await Promise.all([
    prisma.producto.findMany({
      where: {
        activo: true,
        tipoProductoMayorista: { not: null },
        // Solo productos con "Stock disponible" o "Poco Stock" según el proveedor.
        historialStock: {
          some: {
            activo: true,
            estadoStockMayorista: { in: ["Stock disponible", "Poco Stock"] },
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
    eligeCliente
      ? prisma.cliente.findMany({
          select: { id: true, nombre: true, apellido: true, dni: true },
          orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
        })
      : [],
    clienteVinculadoId != null
      ? prisma.cliente.findUnique({ where: { id: clienteVinculadoId }, select: { nombre: true, apellido: true } })
      : null,
  ]);
  const nombreClienteVinculado = clienteVinculado ? `${clienteVinculado.apellido}, ${clienteVinculado.nombre}` : null;

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
  let categoriasTN: CategoriaTN[] = [];
  let errorTiendanube = !config;
  if (config) {
    const [datos, categorias] = await Promise.allSettled([
      traerDatosPorSkuTiendanubeCacheado(config.storeId, config.accessToken),
      traerCategoriasTiendanubeCacheado(config.storeId, config.accessToken),
    ]);
    // Si falla Tiendanube (token vencido, etc.), avisamos en vez de romper la pantalla.
    if (datos.status === "fulfilled") datosTN = datos.value;
    else errorTiendanube = true;
    // Sin categorías el catálogo funciona igual, solo no se muestra el árbol.
    if (categorias.status === "fulfilled") categoriasTN = categorias.value;
  }

  const todos = productos.flatMap((p) => {
    const tn = datosTN.get(p.skuInterno.toUpperCase());
    if (!tn) return [];
    return {
      id: p.id,
      nombre: tn.nombre ?? p.nombreTiendanube ?? p.nombre,
      marca: p.marca,
      estadoStock: estadoStockDe(p.historialStock.map((h) => h.estadoStockMayorista)),
      tipo: LABELS[p.tipoProductoMayorista as TipoProductoMayorista],
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
      categorias: tn.categorias,
    };
  });

  // El árbol se arma con lo que dejó la búsqueda; la categoría elegida filtra en el navegador.
  const arbol = armarArbolCategorias(categoriasTN, todos);
  const productosCatalogo: ProductoCatalogo[] = todos.map((p) => ({ ...p, categorias: arbol.categoriasDe(p) }));

  return (
    <CarritoProvider>
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/inventario" className="text-xs text-gray-400 hover:text-gray-600">← Inventario</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Catálogo mayorista</h1>
          <p className="mt-1 text-sm text-gray-500">
            Selecciona los productos que desees y agregalos a tu carrito de compras, luego prosigue directo desde el carrito. La compra mínima es de {COMPRA_MINIMA_TEXTO}.
          </p>
        </div>
        {puedeComprar && (
          <div className="flex shrink-0 items-center gap-2">
            {nombreClienteVinculado && <BotonMisCarritos />}
            <BotonCarrito clientes={opcionesClientes} clienteFijo={nombreClienteVinculado} />
          </div>
        )}
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
        <ExtrasBusqueda hayBusqueda={!!(q || tipoFiltro)} />
      </form>

      {errorTiendanube && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No se pudo conectar con Tiendanube, por eso no se muestran productos. Probá de nuevo en un rato.
        </p>
      )}

      <CatalogoProductos raices={arbol.raices} productos={productosCatalogo} puedeComprar={puedeComprar} />
    </div>
    </CarritoProvider>
  );
}
