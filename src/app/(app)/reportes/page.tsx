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

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { fechaDesde, fechaHasta, label } = calcularRango(sp.periodo, sp.desde, sp.hasta);

  const [ventas, compras, gastos, productos] = await Promise.all([
    prisma.venta.findMany({
      where: { fechaVenta: { gte: fechaDesde, lte: fechaHasta } },
      include: {
        cliente: true,
        detalles: { include: { producto: { select: { precioCostoUnitario: true, nombre: true, sku: true } } } },
        vendidoPor: { select: { nombre: true, apellido: true } },
        cobradoPor: { select: { nombre: true, apellido: true } },
      },
    }),
    prisma.compra.findMany({
      where: { fechaCompra: { gte: fechaDesde, lte: fechaHasta } },
      include: {
        proveedor: { select: { nombre: true } },
        producto: { select: { nombre: true, sku: true } },
        usuario: { select: { nombre: true, apellido: true } },
        pagadoPor: { select: { nombre: true, apellido: true } },
      },
    }),
    prisma.gasto.findMany({
      where: { fechaGasto: { gte: fechaDesde, lte: fechaHasta } },
    }),
    prisma.producto.findMany({
      orderBy: [{ stockActual: "asc" }, { nombre: "asc" }],
    }),
  ]);

  // ---- VENTAS ----
  let totalBruto = 0;
  let totalDescuentos = 0;
  let costoMercaderia = 0;
  let totalCostoEnvios = 0;

  const productoMap = new Map<string, { nombre: string; sku: string; unidades: number; total: number }>();
  const canalMap = new Map<string, { cantidad: number; total: number }>();
  const pagoMap = new Map<string, { cantidad: number; total: number }>();
  const vendedorMap = new Map<string, { cantidad: number; total: number }>();
  const cobradoPorMap = new Map<string, { cantidad: number; total: number }>();
  const clienteMap = new Map<number, { nombre: string; cantidad: number; total: number }>();

  for (const v of ventas) {
    let brutoVenta = 0;
    let descVenta = 0;
    for (const d of v.detalles) {
      const bruto = Number(d.precioVentaUnitario) * d.cantidad;
      const desc = bruto * (Number(d.descuentoPorcentaje) / 100);
      brutoVenta += bruto;
      descVenta += desc;
      costoMercaderia += Number(d.producto.precioCostoUnitario) * d.cantidad;

      const key = d.producto.sku;
      const prev = productoMap.get(key) ?? { nombre: d.producto.nombre, sku: key, unidades: 0, total: 0 };
      productoMap.set(key, { ...prev, unidades: prev.unidades + d.cantidad, total: prev.total + bruto - desc });
    }
    totalBruto += brutoVenta;
    totalDescuentos += descVenta;
    totalCostoEnvios += Number(v.costoEnvio);

    const neto = brutoVenta - descVenta;

    // canal
    const canal = v.canalVenta;
    const pc = canalMap.get(canal) ?? { cantidad: 0, total: 0 };
    canalMap.set(canal, { cantidad: pc.cantidad + 1, total: pc.total + neto });

    // medio de pago
    const pm = pagoMap.get(v.medioPago) ?? { cantidad: 0, total: 0 };
    pagoMap.set(v.medioPago, { cantidad: pm.cantidad + 1, total: pm.total + neto });

    // vendedor
    const vKey = v.vendidoPor ? `${v.vendidoPor.apellido}, ${v.vendidoPor.nombre}` : "Sin especificar";
    const pv = vendedorMap.get(vKey) ?? { cantidad: 0, total: 0 };
    vendedorMap.set(vKey, { cantidad: pv.cantidad + 1, total: pv.total + neto });

    // cobrador
    const cKey = v.cobradoPor ? `${v.cobradoPor.apellido}, ${v.cobradoPor.nombre}` : "Sin especificar";
    const pcob = cobradoPorMap.get(cKey) ?? { cantidad: 0, total: 0 };
    cobradoPorMap.set(cKey, { cantidad: pcob.cantidad + 1, total: pcob.total + neto });

    // cliente
    const cli = clienteMap.get(v.clienteId) ?? {
      nombre: `${v.cliente.apellido}, ${v.cliente.nombre}`,
      cantidad: 0,
      total: 0,
    };
    clienteMap.set(v.clienteId, { ...cli, cantidad: cli.cantidad + 1, total: cli.total + neto });
  }

  const ganancia = totalBruto - totalDescuentos - costoMercaderia - totalCostoEnvios;

  const rankingProductos = [...productoMap.values()].sort((a, b) => b.total - a.total);
  const topClientes = [...clienteMap.values()].sort((a, b) => b.total - a.total).slice(0, 15);

  // ---- COMPRAS ----
  let totalCompras = 0;
  const proveedorCompraMap = new Map<string, { cantidad: number; total: number }>();
  for (const c of compras) {
    const monto = Number(c.precioCostoUnitario) * c.cantidad;
    totalCompras += monto;
    const prov = c.proveedor.nombre;
    const prev = proveedorCompraMap.get(prov) ?? { cantidad: 0, total: 0 };
    proveedorCompraMap.set(prov, { cantidad: prev.cantidad + 1, total: prev.total + monto });
  }

  // ---- GASTOS ----
  let totalGastos = 0;
  const gastoMap = new Map<string, number>();
  for (const g of gastos) {
    totalGastos += Number(g.monto);
    const cat = g.categoriaGasto as string;
    gastoMap.set(cat, (gastoMap.get(cat) ?? 0) + Number(g.monto));
  }

  // ---- INVENTARIO ----
  const valorStockLista = productos.reduce((acc, p) => acc + p.stockActual * Number(p.precioVenta), 0);
  const valorStockCosto = productos.reduce((acc, p) => acc + p.stockActual * Number(p.precioCostoUnitario), 0);
  const bajoStock = productos.filter((p) => p.stockActual <= 5 && p.stockActual > 0);
  const sinStock = productos.filter((p) => p.stockActual <= 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500">Período: {label}</p>
        </div>
        <Suspense>
          <ExportButton />
        </Suspense>
      </div>

      <Suspense>
        <PeriodoSelector />
      </Suspense>

      {/* ===== VENTAS ===== */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-800 border-b border-gray-200 pb-1">Ventas</h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total facturado (bruto)", value: formatARS(totalBruto) },
            { label: "Descuentos", value: formatARS(totalDescuentos), red: true },
            { label: "Costo mercadería", value: formatARS(costoMercaderia), red: true },
            { label: "Ganancia neta", value: formatARS(ganancia), green: ganancia >= 0 },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`mt-1 text-lg font-semibold ${card.red ? "text-red-600" : card.green ? "text-green-600" : "text-gray-900"}`}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Ranking productos */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <p className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase text-gray-500">Ranking de productos</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-1.5">Producto</th>
                  <th className="px-3 py-1.5 text-right">Uds.</th>
                  <th className="px-3 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rankingProductos.slice(0, 15).map((p) => (
                  <tr key={p.sku}>
                    <td className="px-3 py-1.5">
                      <span className="font-mono text-xs text-gray-400">{p.sku}</span>{" "}
                      {p.nombre}
                    </td>
                    <td className="px-3 py-1.5 text-right">{p.unidades}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{formatARS(p.total)}</td>
                  </tr>
                ))}
                {rankingProductos.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">Sin ventas en el período</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Top clientes */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <p className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase text-gray-500">Clientes</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-1.5">Cliente</th>
                  <th className="px-3 py-1.5 text-right">Ventas</th>
                  <th className="px-3 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topClientes.map((c) => (
                  <tr key={c.nombre}>
                    <td className="px-3 py-1.5">{c.nombre}</td>
                    <td className="px-3 py-1.5 text-right">{c.cantidad}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{formatARS(c.total)}</td>
                  </tr>
                ))}
                {topClientes.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">Sin ventas en el período</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Canal */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <p className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase text-gray-500">Por canal de venta</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-1.5">Canal</th>
                  <th className="px-3 py-1.5 text-right">Ventas</th>
                  <th className="px-3 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...canalMap.entries()].sort((a, b) => b[1].total - a[1].total).map(([canal, data]) => (
                  <tr key={canal}>
                    <td className="px-3 py-1.5">{CANAL_LABELS[canal] ?? canal}</td>
                    <td className="px-3 py-1.5 text-right">{data.cantidad}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{formatARS(data.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Medio de pago */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <p className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase text-gray-500">Por medio de pago</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-1.5">Medio</th>
                  <th className="px-3 py-1.5 text-right">Ventas</th>
                  <th className="px-3 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...pagoMap.entries()].sort((a, b) => b[1].total - a[1].total).map(([medio, data]) => (
                  <tr key={medio}>
                    <td className="px-3 py-1.5">{medio}</td>
                    <td className="px-3 py-1.5 text-right">{data.cantidad}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{formatARS(data.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vendedor */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <p className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase text-gray-500">Vendido por</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-1.5">Vendedor</th>
                  <th className="px-3 py-1.5 text-right">Ventas</th>
                  <th className="px-3 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...vendedorMap.entries()].sort((a, b) => b[1].total - a[1].total).map(([nombre, data]) => (
                  <tr key={nombre}>
                    <td className="px-3 py-1.5">{nombre}</td>
                    <td className="px-3 py-1.5 text-right">{data.cantidad}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{formatARS(data.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cobrador */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <p className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase text-gray-500">Cobrado por</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-1.5">Cobrador</th>
                  <th className="px-3 py-1.5 text-right">Ventas</th>
                  <th className="px-3 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...cobradoPorMap.entries()].sort((a, b) => b[1].total - a[1].total).map(([nombre, data]) => (
                  <tr key={nombre}>
                    <td className="px-3 py-1.5">{nombre}</td>
                    <td className="px-3 py-1.5 text-right">{data.cantidad}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{formatARS(data.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===== COMPRAS ===== */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-800 border-b border-gray-200 pb-1">
          Compras — Total: {formatARS(totalCompras)}
        </h2>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white">
            <p className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase text-gray-500">Por proveedor</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-1.5">Proveedor</th>
                  <th className="px-3 py-1.5 text-right">Compras</th>
                  <th className="px-3 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...proveedorCompraMap.entries()].sort((a, b) => b[1].total - a[1].total).map(([prov, data]) => (
                  <tr key={prov}>
                    <td className="px-3 py-1.5">{prov}</td>
                    <td className="px-3 py-1.5 text-right">{data.cantidad}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{formatARS(data.total)}</td>
                  </tr>
                ))}
                {compras.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">Sin compras en el período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <p className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase text-gray-500">Detalle de compras</p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-400">
              <tr>
                <th className="px-3 py-1.5">Fecha</th>
                <th className="px-3 py-1.5">Proveedor</th>
                <th className="px-3 py-1.5">Producto</th>
                <th className="px-3 py-1.5 text-right">Cant.</th>
                <th className="px-3 py-1.5 text-right">Monto</th>
                <th className="px-3 py-1.5">Cargado por</th>
                <th className="px-3 py-1.5">Pagado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {compras.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs text-gray-500">
                    {new Date(c.fechaCompra).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-3 py-1.5">{c.proveedor.nombre}</td>
                  <td className="px-3 py-1.5">
                    <span className="font-mono text-xs text-gray-400">{c.producto.sku}</span> {c.producto.nombre}
                  </td>
                  <td className="px-3 py-1.5 text-right">{c.cantidad}</td>
                  <td className="px-3 py-1.5 text-right font-medium">
                    {formatARS(Number(c.precioCostoUnitario) * c.cantidad)}
                  </td>
                  <td className="px-3 py-1.5 text-xs">{c.usuario.apellido}, {c.usuario.nombre}</td>
                  <td className="px-3 py-1.5 text-xs">
                    {c.pagadoPor ? `${c.pagadoPor.apellido}, ${c.pagadoPor.nombre}` : "-"}
                  </td>
                </tr>
              ))}
              {compras.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-400">Sin compras en el período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== GASTOS ===== */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-800 border-b border-gray-200 pb-1">
          Gastos — Total: {formatARS(totalGastos)}
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-400">
              <tr>
                <th className="px-3 py-1.5">Categoría</th>
                <th className="px-3 py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...gastoMap.entries()].sort((a, b) => b[1] - a[1]).map(([cat, monto]) => (
                <tr key={cat}>
                  <td className="px-3 py-1.5">{cat}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{formatARS(monto)}</td>
                </tr>
              ))}
              {gastos.length === 0 && (
                <tr><td colSpan={2} className="px-3 py-4 text-center text-gray-400">Sin gastos en el período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== INVENTARIO ===== */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-800 border-b border-gray-200 pb-1">Inventario (estado actual)</h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Productos", value: String(productos.length) },
            { label: "Valor stock (precio lista)", value: formatARS(valorStockLista) },
            { label: "Valor stock (costo)", value: formatARS(valorStockCosto) },
            { label: "Bajo stock / Sin stock", value: `${bajoStock.length} / ${sinStock.length}`, red: bajoStock.length > 0 || sinStock.length > 0 },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`mt-1 text-lg font-semibold ${card.red ? "text-red-600" : "text-gray-900"}`}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2 text-right">Costo unit.</th>
                <th className="px-3 py-2 text-right">Precio lista</th>
                <th className="px-3 py-2 text-right">Valor lista</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {productos.map((p) => {
                const bajo = p.stockActual <= 5;
                return (
                  <tr key={p.id} className={bajo ? "bg-red-50" : "hover:bg-gray-50"}>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">{p.sku}</td>
                    <td className="px-3 py-1.5">{p.nombre}</td>
                    <td className="px-3 py-1.5 text-gray-500">{p.categoria}</td>
                    <td className={`px-3 py-1.5 text-right font-medium ${bajo ? "text-red-600" : ""}`}>
                      {p.stockActual}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{formatARS(Number(p.precioCostoUnitario))}</td>
                    <td className="px-3 py-1.5 text-right">{formatARS(Number(p.precioVenta))}</td>
                    <td className="px-3 py-1.5 text-right font-medium">
                      {formatARS(p.stockActual * Number(p.precioVenta))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
