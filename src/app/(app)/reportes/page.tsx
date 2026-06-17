import { Suspense } from "react";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { calcularRango, formatARS } from "@/lib/reporte-utils";
import { PeriodoSelector } from "./periodo-selector";
import { ExportButton } from "./export-button";

const CANAL_LABELS: Record<string, string> = {
  TIENDANUBE: "Tiendanube",
  WHATSAPP: "WhatsApp",
  TELEFONO: "Teléfono",
};

const TIPOS_REPORTE = [
  { value: "ventas-resumen", label: "Ventas — Resumen" },
  { value: "ranking-productos", label: "Ventas — Ranking de productos" },
  { value: "por-canal", label: "Ventas — Por canal y medio de pago" },
  { value: "por-vendedor", label: "Ventas — Por vendedor / cobrador" },
  { value: "por-cliente", label: "Ventas — Por cliente" },
  { value: "compras", label: "Compras" },
  { value: "gastos", label: "Gastos" },
  { value: "inventario", label: "Inventario" },
];

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string; tipo?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const tipo = sp.tipo ?? "ventas-resumen";
  const { fechaDesde, fechaHasta, label } = calcularRango(sp.periodo, sp.desde, sp.hasta);

  const needsVentas = tipo.startsWith("ventas") || tipo === "ranking-productos" || tipo === "por-canal" || tipo === "por-vendedor" || tipo === "por-cliente";
  const needsCompras = tipo === "compras";
  const needsGastos = tipo === "gastos";
  const needsInventario = tipo === "inventario";

  const [ventas, compras, gastos, productos] = await Promise.all([
    needsVentas
      ? prisma.venta.findMany({
          where: { fechaVenta: { gte: fechaDesde, lte: fechaHasta } },
          include: {
            cliente: true,
            detalles: { include: { producto: { select: { precioCostoUnitario: true, nombre: true, sku: true } } } },
            vendidoPor: { select: { nombre: true, apellido: true } },
            cobradoPor: { select: { nombre: true, apellido: true } },
          },
        })
      : Promise.resolve([]),
    needsCompras
      ? prisma.compra.findMany({
          where: { fechaCompra: { gte: fechaDesde, lte: fechaHasta } },
          include: {
            proveedor: { select: { nombre: true } },
            producto: { select: { nombre: true, sku: true } },
            usuario: { select: { nombre: true, apellido: true } },
            pagadoPor: { select: { nombre: true, apellido: true } },
          },
          orderBy: { fechaCompra: "asc" },
        })
      : Promise.resolve([]),
    needsGastos
      ? prisma.gasto.findMany({
          where: { fechaGasto: { gte: fechaDesde, lte: fechaHasta } },
          include: {
            usuario: { select: { nombre: true, apellido: true } },
            pagadoPor: { select: { nombre: true, apellido: true } },
          },
          orderBy: { fechaGasto: "asc" },
        })
      : Promise.resolve([]),
    needsInventario
      ? prisma.producto.findMany({ orderBy: [{ stockActual: "asc" }, { nombre: "asc" }] })
      : Promise.resolve([]),
  ]);

  // ---- Agregaciones de ventas ----
  let totalBruto = 0, totalDescuentos = 0, costoMercaderia = 0, totalCostoEnvios = 0;
  const productoMap = new Map<string, { nombre: string; sku: string; unidades: number; total: number }>();
  const canalMap = new Map<string, { cantidad: number; total: number }>();
  const pagoMap = new Map<string, { cantidad: number; total: number }>();
  const vendedorMap = new Map<string, { cantidad: number; total: number }>();
  const cobradoPorMap = new Map<string, { cantidad: number; total: number }>();
  const clienteMap = new Map<number, { nombre: string; cantidad: number; total: number }>();

  for (const v of ventas) {
    let brutoVenta = 0, descVenta = 0;
    for (const d of v.detalles) {
      const bruto = Number(d.precioVentaUnitario) * d.cantidad;
      const desc = bruto * (Number(d.descuentoPorcentaje) / 100);
      brutoVenta += bruto; descVenta += desc;
      costoMercaderia += Number(d.producto.precioCostoUnitario) * d.cantidad;
      const prev = productoMap.get(d.producto.sku) ?? { nombre: d.producto.nombre, sku: d.producto.sku, unidades: 0, total: 0 };
      productoMap.set(d.producto.sku, { ...prev, unidades: prev.unidades + d.cantidad, total: prev.total + bruto - desc });
    }
    totalBruto += brutoVenta; totalDescuentos += descVenta;
    totalCostoEnvios += Number(v.costoEnvio);
    const neto = brutoVenta - descVenta;
    const inc = (m: Map<string, { cantidad: number; total: number }>, k: string) => m.set(k, { cantidad: (m.get(k)?.cantidad ?? 0) + 1, total: (m.get(k)?.total ?? 0) + neto });
    inc(canalMap, v.canalVenta);
    inc(pagoMap, v.medioPago);
    inc(vendedorMap, v.vendidoPor ? `${v.vendidoPor.apellido}, ${v.vendidoPor.nombre}` : "Sin especificar");
    inc(cobradoPorMap, v.cobradoPor ? `${v.cobradoPor.apellido}, ${v.cobradoPor.nombre}` : "Sin especificar");
    const cli = clienteMap.get(v.clienteId) ?? { nombre: `${v.cliente.apellido}, ${v.cliente.nombre}`, cantidad: 0, total: 0 };
    clienteMap.set(v.clienteId, { ...cli, cantidad: cli.cantidad + 1, total: cli.total + neto });
  }
  const ganancia = totalBruto - totalDescuentos - costoMercaderia - totalCostoEnvios;

  const tipoLabel = TIPOS_REPORTE.find((t) => t.value === tipo)?.label ?? "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Reportes</h1>
        <Suspense>
          <ExportButton />
        </Suspense>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <Suspense>
          <PeriodoSelector tipo={tipo} />
        </Suspense>
      </div>

      {/* Título del reporte activo */}
      <div>
        <p className="text-sm text-gray-500">{tipoLabel} — {label}</p>
      </div>

      {/* ===== VENTAS RESUMEN ===== */}
      {tipo === "ventas-resumen" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total bruto", value: formatARS(totalBruto) },
              { label: "Descuentos", value: formatARS(totalDescuentos), red: true },
              { label: "Costo mercadería", value: formatARS(costoMercaderia), red: true },
              { label: "Ganancia neta", value: formatARS(ganancia), green: ganancia >= 0, red: ganancia < 0 },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`mt-1 text-xl font-semibold ${c.red ? "text-red-600" : c.green ? "text-green-600" : "text-gray-900"}`}>{c.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 space-y-1">
            <p>Ventas: <span className="font-medium text-gray-800">{ventas.length}</span></p>
            <p>Costo envíos: <span className="font-medium text-gray-800">{formatARS(totalCostoEnvios)}</span></p>
            <p>Total neto (bruto − descuentos): <span className="font-medium text-gray-800">{formatARS(totalBruto - totalDescuentos)}</span></p>
          </div>
        </div>
      )}

      {/* ===== RANKING PRODUCTOS ===== */}
      {tipo === "ranking-productos" && (
        <ReporteTable
          headers={["SKU", "Producto", "Unidades", "Total"]}
          rows={[...productoMap.values()].sort((a, b) => b.total - a.total).map((p) => [p.sku, p.nombre, p.unidades, formatARS(p.total)])}
          alignRight={[2, 3]}
          empty="Sin ventas en el período"
        />
      )}

      {/* ===== POR CANAL Y MEDIO DE PAGO ===== */}
      {tipo === "por-canal" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Por canal</p>
            <ReporteTable
              headers={["Canal", "Ventas", "Total"]}
              rows={[...canalMap.entries()].sort((a, b) => b[1].total - a[1].total).map(([k, v]) => [CANAL_LABELS[k] ?? k, v.cantidad, formatARS(v.total)])}
              alignRight={[1, 2]}
              empty="Sin ventas"
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Por medio de pago</p>
            <ReporteTable
              headers={["Medio", "Ventas", "Total"]}
              rows={[...pagoMap.entries()].sort((a, b) => b[1].total - a[1].total).map(([k, v]) => [k, v.cantidad, formatARS(v.total)])}
              alignRight={[1, 2]}
              empty="Sin ventas"
            />
          </div>
        </div>
      )}

      {/* ===== POR VENDEDOR / COBRADOR ===== */}
      {tipo === "por-vendedor" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Vendido por</p>
            <ReporteTable
              headers={["Vendedor", "Ventas", "Total"]}
              rows={[...vendedorMap.entries()].sort((a, b) => b[1].total - a[1].total).map(([k, v]) => [k, v.cantidad, formatARS(v.total)])}
              alignRight={[1, 2]}
              empty="Sin ventas"
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Cobrado por</p>
            <ReporteTable
              headers={["Cobrador", "Ventas", "Total"]}
              rows={[...cobradoPorMap.entries()].sort((a, b) => b[1].total - a[1].total).map(([k, v]) => [k, v.cantidad, formatARS(v.total)])}
              alignRight={[1, 2]}
              empty="Sin ventas"
            />
          </div>
        </div>
      )}

      {/* ===== POR CLIENTE ===== */}
      {tipo === "por-cliente" && (
        <ReporteTable
          headers={["Cliente", "Ventas", "Total"]}
          rows={[...clienteMap.values()].sort((a, b) => b.total - a.total).map((c) => [c.nombre, c.cantidad, formatARS(c.total)])}
          alignRight={[1, 2]}
          empty="Sin ventas en el período"
        />
      )}

      {/* ===== COMPRAS ===== */}
      {tipo === "compras" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Total compras: <span className="font-semibold text-gray-800">
              {formatARS(compras.reduce((acc, c) => acc + Number(c.precioCostoUnitario) * c.cantidad, 0))}
            </span>
          </p>
          <ReporteTable
            headers={["Fecha", "Proveedor", "SKU", "Producto", "Cant.", "Monto", "Cargado por", "Pagado por"]}
            rows={compras.map((c) => [
              new Date(c.fechaCompra).toLocaleDateString("es-AR"),
              c.proveedor.nombre,
              c.producto.sku,
              c.producto.nombre,
              c.cantidad,
              formatARS(Number(c.precioCostoUnitario) * c.cantidad),
              `${c.usuario.apellido}, ${c.usuario.nombre}`,
              c.pagadoPor ? `${c.pagadoPor.apellido}, ${c.pagadoPor.nombre}` : "-",
            ])}
            alignRight={[4, 5]}
            empty="Sin compras en el período"
          />
        </div>
      )}

      {/* ===== GASTOS ===== */}
      {tipo === "gastos" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Total gastos: <span className="font-semibold text-gray-800">
              {formatARS(gastos.reduce((acc, g) => acc + Number(g.monto), 0))}
            </span>
          </p>
          <ReporteTable
            headers={["Fecha", "Categoría", "Monto", "Cargado por", "Pagado por", "Descripción"]}
            rows={gastos.map((g) => [
              new Date(g.fechaGasto).toLocaleDateString("es-AR"),
              g.categoriaGasto,
              formatARS(Number(g.monto)),
              g.usuario ? `${g.usuario.apellido}, ${g.usuario.nombre}` : "-",
              g.pagadoPor ? `${g.pagadoPor.apellido}, ${g.pagadoPor.nombre}` : "-",
              g.descripcion ?? "",
            ])}
            alignRight={[2]}
            empty="Sin gastos en el período"
          />
        </div>
      )}

      {/* ===== INVENTARIO ===== */}
      {tipo === "inventario" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Valor stock (lista)", value: formatARS(productos.reduce((a, p) => a + p.stockActual * Number(p.precioVenta), 0)) },
              { label: "Valor stock (costo)", value: formatARS(productos.reduce((a, p) => a + p.stockActual * Number(p.precioCostoUnitario), 0)) },
              { label: "Bajo stock (≤5)", value: String(productos.filter((p) => p.stockActual <= 5).length), red: productos.some((p) => p.stockActual <= 5) },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`mt-1 text-xl font-semibold ${c.red ? "text-red-600" : "text-gray-900"}`}>{c.value}</p>
              </div>
            ))}
          </div>
          <ReporteTable
            headers={["SKU", "Nombre", "Categoría", "Stock", "Costo unit.", "Precio lista", "Valor lista"]}
            rows={productos.map((p) => [p.sku, p.nombre, p.categoria, p.stockActual, formatARS(Number(p.precioCostoUnitario)), formatARS(Number(p.precioVenta)), formatARS(p.stockActual * Number(p.precioVenta))])}
            alignRight={[3, 4, 5, 6]}
            empty="Sin productos"
          />
        </div>
      )}
    </div>
  );
}

function ReporteTable({
  headers,
  rows,
  alignRight = [],
  empty,
}: {
  headers: string[];
  rows: (string | number)[][];
  alignRight?: number[];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 ${alignRight.includes(i) ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-3 py-6 text-center text-gray-400">{empty}</td></tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-gray-50">
                {row.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-2 ${alignRight.includes(ci) ? "text-right tabular-nums" : ""}`}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
