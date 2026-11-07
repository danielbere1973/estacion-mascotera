import { Suspense } from "react";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { calcularRango } from "@/lib/reporte-utils";
import { FiltroPeriodo } from "./filtro-periodo";
import { ProductosMasVendidos, ClientesMasCompras, GastosPorCategoria, type ProductoRanking } from "./rankings";

function rangoEstadisticas(periodo: string | undefined, desde: string | undefined, hasta: string | undefined) {
  const now = new Date();
  if (!periodo || periodo === "todo") return { fechaDesde: undefined, fechaHasta: undefined, label: "Histórico" };
  if (periodo === "anio") return { fechaDesde: new Date(now.getFullYear(), 0, 1), fechaHasta: now, label: "Este año" };
  return calcularRango(periodo, desde, hasta);
}

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { fechaDesde, fechaHasta, label } = rangoEstadisticas(sp.periodo, sp.desde, sp.hasta);
  const rangoVenta = fechaDesde ? { fechaVenta: { gte: fechaDesde, lte: fechaHasta } } : {};
  const rangoGasto = fechaDesde ? { fechaGasto: { gte: fechaDesde, lte: fechaHasta } } : {};

  const [ventas, gastos] = await Promise.all([
    prisma.venta.findMany({
      where: { ...rangoVenta, esVentaInterna: false },
      select: {
        clienteId: true,
        cliente: { select: { nombre: true, apellido: true } },
        detalles: {
          select: {
            cantidad: true,
            precioVentaUnitario: true,
            descuentoPorcentaje: true,
            producto: { select: { id: true, nombre: true, skuInterno: true } },
          },
        },
      },
    }),
    prisma.gasto.groupBy({
      by: ["categoriaGasto"],
      where: rangoGasto,
      _sum: { monto: true },
      _count: { _all: true },
    }),
  ]);

  const productoMap = new Map<number, ProductoRanking>();
  const clienteMap = new Map<number, { nombre: string; compras: number; unidades: number; total: number }>();

  for (const v of ventas) {
    let netoVenta = 0;
    let unidadesVenta = 0;
    for (const d of v.detalles) {
      const bruto = Number(d.precioVentaUnitario) * d.cantidad;
      const neto = bruto - bruto * (Number(d.descuentoPorcentaje) / 100);
      netoVenta += neto;
      unidadesVenta += d.cantidad;
      const p = productoMap.get(d.producto.id) ?? { sku: d.producto.skuInterno, nombre: d.producto.nombre, unidades: 0, total: 0, ventas: 0 };
      p.unidades += d.cantidad;
      p.total += neto;
      p.ventas += 1;
      productoMap.set(d.producto.id, p);
    }
    const c = clienteMap.get(v.clienteId) ?? { nombre: `${v.cliente.apellido}, ${v.cliente.nombre}`, compras: 0, unidades: 0, total: 0 };
    c.compras += 1;
    c.unidades += unidadesVenta;
    c.total += netoVenta;
    clienteMap.set(v.clienteId, c);
  }

  const productos = [...productoMap.values()].sort((a, b) => b.unidades - a.unidades || b.total - a.total);
  const clientes = [...clienteMap.values()].sort((a, b) => b.total - a.total || b.compras - a.compras);
  const categorias = gastos
    .map((g) => ({ categoria: g.categoriaGasto || "Sin categoría", cantidad: g._count._all, total: Number(g._sum.monto ?? 0) }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="w-full space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">Estadísticas</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <Suspense>
          <FiltroPeriodo />
        </Suspense>
      </div>

      <p className="text-sm text-gray-500">Período: {label}</p>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      {/* ===== PRODUCTOS MÁS VENDIDOS ===== */}
      <section className="min-w-0 space-y-2">
        <h2 className="text-base font-semibold text-gray-800">Productos más vendidos</h2>
        <ProductosMasVendidos productos={productos} />
      </section>

      {/* ===== CLIENTES CON MÁS COMPRAS ===== */}
      <section className="min-w-0 space-y-2">
        <h2 className="text-base font-semibold text-gray-800">Clientes con más compras</h2>
        <ClientesMasCompras clientes={clientes} />
      </section>
      </div>

      {/* ===== GASTOS POR CATEGORÍA ===== */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-gray-800">Gastos por categoría</h2>
        <GastosPorCategoria categorias={categorias} />
      </section>
    </div>
  );
}
