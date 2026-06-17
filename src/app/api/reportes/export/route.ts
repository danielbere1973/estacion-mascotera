import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { calcularRango } from "@/lib/reporte-utils";
import { auth } from "@/auth";

const CANAL_LABELS: Record<string, string> = { TIENDANUBE: "Tiendanube", WHATSAPP: "WhatsApp", TELEFONO: "Teléfono" };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const tipo = sp.get("tipo") ?? "ventas-resumen";
  const { fechaDesde, fechaHasta, label } = calcularRango(
    sp.get("periodo") ?? undefined,
    sp.get("desde") ?? undefined,
    sp.get("hasta") ?? undefined
  );

  const wb = XLSX.utils.book_new();

  if (tipo.startsWith("ventas") || tipo === "ranking-productos" || tipo === "por-canal" || tipo === "por-vendedor" || tipo === "por-cliente") {
    const ventas = await prisma.venta.findMany({
      where: { fechaVenta: { gte: fechaDesde, lte: fechaHasta } },
      include: {
        cliente: true,
        detalles: { include: { producto: { select: { precioCostoUnitario: true, nombre: true, sku: true } } } },
        vendidoPor: { select: { nombre: true, apellido: true } },
        cobradoPor: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fechaVenta: "asc" },
    });

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

    if (tipo === "ventas-resumen") {
      const rows = [
        ["Métrica", "Valor"],
        ["Total bruto", totalBruto],
        ["Descuentos", totalDescuentos],
        ["Costo mercadería", costoMercaderia],
        ["Costo envíos", totalCostoEnvios],
        ["Ganancia neta", totalBruto - totalDescuentos - costoMercaderia - totalCostoEnvios],
        ["Cantidad de ventas", ventas.length],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Resumen ventas");
    }

    if (tipo === "ranking-productos") {
      const rows: unknown[][] = [["SKU", "Producto", "Unidades", "Total $"]];
      for (const p of [...productoMap.values()].sort((a, b) => b.total - a.total)) {
        rows.push([p.sku, p.nombre, p.unidades, p.total]);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Ranking productos");
    }

    if (tipo === "por-canal") {
      const r1: unknown[][] = [["Canal", "Ventas", "Total $"]];
      for (const [k, v] of [...canalMap.entries()].sort((a, b) => b[1].total - a[1].total)) r1.push([CANAL_LABELS[k] ?? k, v.cantidad, v.total]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r1), "Por canal");

      const r2: unknown[][] = [["Medio de pago", "Ventas", "Total $"]];
      for (const [k, v] of [...pagoMap.entries()].sort((a, b) => b[1].total - a[1].total)) r2.push([k, v.cantidad, v.total]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r2), "Por medio de pago");
    }

    if (tipo === "por-vendedor") {
      const r1: unknown[][] = [["Vendedor", "Ventas", "Total $"]];
      for (const [k, v] of [...vendedorMap.entries()].sort((a, b) => b[1].total - a[1].total)) r1.push([k, v.cantidad, v.total]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r1), "Vendido por");

      const r2: unknown[][] = [["Cobrador", "Ventas", "Total $"]];
      for (const [k, v] of [...cobradoPorMap.entries()].sort((a, b) => b[1].total - a[1].total)) r2.push([k, v.cantidad, v.total]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r2), "Cobrado por");
    }

    if (tipo === "por-cliente") {
      const rows: unknown[][] = [["Cliente", "Ventas", "Total $"]];
      for (const c of [...clienteMap.values()].sort((a, b) => b.total - a.total)) rows.push([c.nombre, c.cantidad, c.total]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Por cliente");
    }
  }

  if (tipo === "compras") {
    const compras = await prisma.compra.findMany({
      where: { fechaCompra: { gte: fechaDesde, lte: fechaHasta } },
      include: {
        proveedor: { select: { nombre: true } },
        producto: { select: { nombre: true, sku: true } },
        usuario: { select: { nombre: true, apellido: true } },
        pagadoPor: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fechaCompra: "asc" },
    });
    const rows: unknown[][] = [["Fecha", "Proveedor", "SKU", "Producto", "Cant.", "Precio unit.", "Monto", "Cargado por", "Pagado por"]];
    for (const c of compras) {
      rows.push([
        new Date(c.fechaCompra).toLocaleDateString("es-AR"),
        c.proveedor.nombre, c.producto.sku, c.producto.nombre, c.cantidad,
        Number(c.precioCostoUnitario), Number(c.precioCostoUnitario) * c.cantidad,
        `${c.usuario.apellido}, ${c.usuario.nombre}`,
        c.pagadoPor ? `${c.pagadoPor.apellido}, ${c.pagadoPor.nombre}` : "",
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Compras");
  }

  if (tipo === "gastos") {
    const gastos = await prisma.gasto.findMany({
      where: { fechaGasto: { gte: fechaDesde, lte: fechaHasta } },
      include: {
        usuario: { select: { nombre: true, apellido: true } },
        pagadoPor: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fechaGasto: "asc" },
    });
    const rows: unknown[][] = [["Fecha", "Categoría", "Monto", "Cargado por", "Pagado por", "Descripción"]];
    for (const g of gastos) rows.push([
      new Date(g.fechaGasto).toLocaleDateString("es-AR"),
      g.categoriaGasto,
      Number(g.monto),
      g.usuario ? `${g.usuario.apellido}, ${g.usuario.nombre}` : "",
      g.pagadoPor ? `${g.pagadoPor.apellido}, ${g.pagadoPor.nombre}` : "",
      g.descripcion ?? "",
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Gastos");
  }

  if (tipo === "inventario") {
    const productos = await prisma.producto.findMany({ orderBy: { nombre: "asc" } });
    const rows: unknown[][] = [["SKU", "Nombre", "Categoría", "Stock", "Costo unit.", "Precio lista", "Valor lista", "Valor costo"]];
    for (const p of productos) {
      rows.push([p.sku, p.nombre, p.categoria, p.stockActual, Number(p.precioCostoUnitario), Number(p.precioVenta), p.stockActual * Number(p.precioVenta), p.stockActual * Number(p.precioCostoUnitario)]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Inventario");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `reporte-${tipo}-${label.replace(/\s/g, "-").replace(/\//g, "-")}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
