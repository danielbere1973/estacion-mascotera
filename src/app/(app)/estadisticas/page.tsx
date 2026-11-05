import { Suspense } from "react";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { calcularRango, formatARS } from "@/lib/reporte-utils";
import { FiltroPeriodo } from "./filtro-periodo";
import { ProductosMasVendidos, type ProductoRanking } from "./productos-mas-vendidos";

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
  const totalGastos = categorias.reduce((a, c) => a + c.total, 0);

  return (
    <div className="w-full space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">Estadísticas</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <Suspense>
          <FiltroPeriodo />
        </Suspense>
      </div>

      <p className="text-sm text-gray-500">Período: {label}</p>

      {/* ===== PRODUCTOS MÁS VENDIDOS ===== */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-gray-800">Productos más vendidos</h2>
        <ProductosMasVendidos productos={productos} />
      </section>

      {/* ===== CLIENTES CON MÁS COMPRAS ===== */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-gray-800">Clientes con más compras</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2 text-right">Compras</th>
                <th className="hidden px-3 py-2 text-right sm:table-cell">Unidades</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientes.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Sin ventas en el período</td></tr>
              ) : (
                clientes.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2">{c.nombre}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.compras}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{c.unidades}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatARS(c.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== GASTOS POR CATEGORÍA ===== */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-gray-800">Gastos por categoría</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2 text-right">Gastos</th>
                <th className="hidden px-3 py-2 text-right sm:table-cell">% del total</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categorias.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Sin gastos en el período</td></tr>
              ) : (
                categorias.map((c, i) => (
                  <tr key={c.categoria} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2">{c.categoria}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.cantidad}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                      {totalGastos > 0 ? `${((c.total / totalGastos) * 100).toFixed(1)}%` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatARS(c.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {categorias.length > 0 && (
              <tfoot className="bg-gray-50 text-sm font-semibold text-gray-800">
                <tr>
                  <td colSpan={2} className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{categorias.reduce((a, c) => a + c.cantidad, 0)}</td>
                  <td className="hidden px-3 py-2 sm:table-cell" />
                  <td className="px-3 py-2 text-right tabular-nums">{formatARS(totalGastos)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
