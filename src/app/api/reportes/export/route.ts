import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { calcularRango } from "@/lib/reporte-utils";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const { fechaDesde, fechaHasta, label } = calcularRango(
    sp.get("periodo") ?? undefined,
    sp.get("desde") ?? undefined,
    sp.get("hasta") ?? undefined
  );

  const [ventas, compras, gastos, productos] = await Promise.all([
    prisma.venta.findMany({
      where: { fechaVenta: { gte: fechaDesde, lte: fechaHasta } },
      include: {
        cliente: true,
        detalles: { include: { producto: { select: { precioCostoUnitario: true, nombre: true, sku: true } } } },
        vendidoPor: { select: { nombre: true, apellido: true } },
        cobradoPor: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fechaVenta: "asc" },
    }),
    prisma.compra.findMany({
      where: { fechaCompra: { gte: fechaDesde, lte: fechaHasta } },
      include: {
        proveedor: { select: { nombre: true } },
        producto: { select: { nombre: true, sku: true } },
        usuario: { select: { nombre: true, apellido: true } },
        pagadoPor: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fechaCompra: "asc" },
    }),
    prisma.gasto.findMany({
      where: { fechaGasto: { gte: fechaDesde, lte: fechaHasta } },
      orderBy: { fechaGasto: "asc" },
    }),
    prisma.producto.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const wb = XLSX.utils.book_new();

  // ---- Hoja: Ventas detalle ----
  const ventasRows: unknown[][] = [
    ["Fecha", "Cliente", "Canal", "Medio pago", "Vendido por", "Cobrado por", "SKU", "Producto", "Cant.", "Precio unit.", "Desc %", "Subtotal neto", "Costo envío"],
  ];
  for (const v of ventas) {
    for (const d of v.detalles) {
      const bruto = Number(d.precioVentaUnitario) * d.cantidad;
      const neto = bruto * (1 - Number(d.descuentoPorcentaje) / 100);
      ventasRows.push([
        new Date(v.fechaVenta).toLocaleDateString("es-AR"),
        `${v.cliente.apellido}, ${v.cliente.nombre}`,
        v.canalVenta,
        v.medioPago,
        v.vendidoPor ? `${v.vendidoPor.apellido}, ${v.vendidoPor.nombre}` : "",
        v.cobradoPor ? `${v.cobradoPor.apellido}, ${v.cobradoPor.nombre}` : "",
        d.producto.sku,
        d.producto.nombre,
        d.cantidad,
        Number(d.precioVentaUnitario),
        Number(d.descuentoPorcentaje),
        neto,
        v.detalles.indexOf(d) === 0 ? Number(v.costoEnvio) : 0,
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ventasRows), "Ventas");

  // ---- Hoja: Compras ----
  const comprasRows: unknown[][] = [
    ["Fecha", "Proveedor", "SKU", "Producto", "Cant.", "Precio unit.", "Monto total", "Cargado por", "Pagado por"],
  ];
  for (const c of compras) {
    comprasRows.push([
      new Date(c.fechaCompra).toLocaleDateString("es-AR"),
      c.proveedor.nombre,
      c.producto.sku,
      c.producto.nombre,
      c.cantidad,
      Number(c.precioCostoUnitario),
      Number(c.precioCostoUnitario) * c.cantidad,
      `${c.usuario.apellido}, ${c.usuario.nombre}`,
      c.pagadoPor ? `${c.pagadoPor.apellido}, ${c.pagadoPor.nombre}` : "",
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(comprasRows), "Compras");

  // ---- Hoja: Gastos ----
  const gastosRows: unknown[][] = [["Fecha", "Categoría", "Monto", "Descripción"]];
  for (const g of gastos) {
    gastosRows.push([
      new Date(g.fechaGasto).toLocaleDateString("es-AR"),
      g.categoriaGasto,
      Number(g.monto),
      g.descripcion ?? "",
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gastosRows), "Gastos");

  // ---- Hoja: Inventario ----
  const inventarioRows: unknown[][] = [
    ["SKU", "Nombre", "Categoría", "Stock", "Costo unit.", "Precio lista", "Valor lista", "Valor costo"],
  ];
  for (const p of productos) {
    inventarioRows.push([
      p.sku,
      p.nombre,
      p.categoria,
      p.stockActual,
      Number(p.precioCostoUnitario),
      Number(p.precioVenta),
      p.stockActual * Number(p.precioVenta),
      p.stockActual * Number(p.precioCostoUnitario),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inventarioRows), "Inventario");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `reporte-${label.replace(/\s/g, "-").replace(/\//g, "-")}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
