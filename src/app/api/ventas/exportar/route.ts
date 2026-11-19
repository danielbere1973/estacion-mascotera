import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { prisma } from "@/lib/prisma";
import { perfilAcceso, puedeVer } from "@/lib/permissions";
import { armarFiltroVentas, leerFiltroVentas } from "@/lib/filtro-ventas";

// Exportar el listado de Ventas (con los filtros aplicados) en PDF, XLS o DOC.
// Exportar es leer: alcanza con tener la sección Ventas (también para Solo lectura).
// No incluye costos ni ganancias, así sirve igual para usuarios con restricción de proveedores.

const CANAL_LABELS: Record<string, string> = { TIENDANUBE: "Tiendanube", WHATSAPP: "WhatsApp", TELEFONO: "Teléfono" };
const COLUMNAS = ["ID", "Fecha", "Cliente", "CUIT/DNI", "Canal", "Medio de pago", "Productos", "Total", "Facturado", "Estado de pago"];

const fecha = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});
const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

function escaparHtml(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest) {
  if (!(await puedeVer("VENTAS"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const formato = sp.get("formato");
  if (formato !== "pdf" && formato !== "xls" && formato !== "doc") {
    return NextResponse.json({ error: "Formato inválido (pdf, xls o doc)" }, { status: 400 });
  }

  const { proveedores } = await perfilAcceso();
  const where = await armarFiltroVentas(
    leerFiltroVentas((k) => sp.get(k), (k) => sp.getAll(k)),
    proveedores
  );

  const ventas = await prisma.venta.findMany({
    where,
    orderBy: { fechaVenta: "desc" },
    select: {
      id: true,
      fechaVenta: true,
      canalVenta: true,
      medioPago: true,
      costoEnvio: true,
      facturado: true,
      numeroFactura: true,
      esVentaInterna: true,
      esMayorista: true,
      cliente: { select: { nombre: true, apellido: true, cuit: true, dni: true } },
      detalles: {
        select: {
          cantidad: true,
          precioVentaUnitario: true,
          descuentoPorcentaje: true,
          producto: { select: { nombre: true } },
        },
      },
      pagos: { select: { monto: true } },
    },
  });

  // Mismo cálculo que la pantalla: total abonado = productos - descuentos + envío.
  let totalGeneral = 0;
  const filas = ventas.map((v) => {
    const total =
      v.detalles.reduce(
        (acc, d) => acc + d.cantidad * Number(d.precioVentaUnitario) * (1 - Number(d.descuentoPorcentaje) / 100),
        0
      ) + Number(v.costoEnvio);
    totalGeneral += total;
    const pagado = v.pagos.reduce((acc, p) => acc + Number(p.monto), 0);
    const estadoPago = pagado <= 0 ? "Pendiente de pago" : pagado >= total - 0.01 ? "Cobrado" : "Parcialmente pagado";
    const canal = CANAL_LABELS[v.canalVenta] ?? v.canalVenta;
    return {
      id: v.id,
      fecha: fecha.format(v.fechaVenta),
      cliente: `${v.cliente.apellido}, ${v.cliente.nombre}`,
      documento: v.cliente.cuit || v.cliente.dni || "",
      canal: v.esVentaInterna ? `${canal} (interna)` : v.esMayorista ? `${canal} (mayorista)` : canal,
      medioPago: v.medioPago,
      productos: v.detalles.map((d) => `${d.cantidad}x ${d.producto.nombre}`).join("; "),
      total,
      facturado: v.facturado ? (v.numeroFactura ? `Sí (${v.numeroFactura})` : "Sí") : "No",
      estadoPago,
    };
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `ventas-${hoy}`;
  const resumen = `${filas.length} venta${filas.length !== 1 ? "s" : ""} · Total ${moneda.format(totalGeneral)}`;
  const filaTexto = (f: (typeof filas)[number]) => [
    String(f.id),
    f.fecha,
    f.cliente,
    f.documento,
    f.canal,
    f.medioPago,
    f.productos,
    moneda.format(f.total),
    f.facturado,
    f.estadoPago,
  ];

  if (formato === "xls") {
    const hoja = XLSX.utils.aoa_to_sheet([
      COLUMNAS,
      ...filas.map((f) => [f.id, f.fecha, f.cliente, f.documento, f.canal, f.medioPago, f.productos, Math.round(f.total * 100) / 100, f.facturado, f.estadoPago]),
      [],
      ["", "", "", "", "", "", "Total", Math.round(totalGeneral * 100) / 100],
    ]);
    hoja["!cols"] = [6, 11, 28, 15, 18, 16, 60, 14, 16, 18].map((wch) => ({ wch }));
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Ventas");
    const buffer = XLSX.write(libro, { type: "buffer", bookType: "biff8" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": `attachment; filename="${nombreArchivo}.xls"`,
      },
    });
  }

  if (formato === "doc") {
    // Documento HTML con extensión .doc: Word lo abre como documento.
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Ventas</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  @page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 1.5cm; }
  div.Section1 { page: Section1; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 9pt; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 3pt 4pt; vertical-align: top; }
  th { background: #E5E7EB; text-align: left; }
  td.num { text-align: right; white-space: nowrap; }
</style></head>
<body><div class="Section1">
<h2>Ventas — Estación Mascotera</h2>
<p>Exportado el ${fecha.format(new Date())} · ${escaparHtml(resumen)}</p>
<table>
<tr>${COLUMNAS.map((c) => `<th>${c}</th>`).join("")}</tr>
${filas
  .map(
    (f) =>
      `<tr>${filaTexto(f)
        .map((celda, i) => `<td${i === 7 ? ' class="num"' : ""}>${escaparHtml(celda)}</td>`)
        .join("")}</tr>`
  )
  .join("\n")}
<tr><td colspan="7" style="text-align:right"><b>Total</b></td><td class="num"><b>${escaparHtml(moneda.format(totalGeneral))}</b></td><td colspan="2"></td></tr>
</table>
</div></body></html>`;
    return new NextResponse("﻿" + html, {
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombreArchivo}.doc"`,
      },
    });
  }

  // PDF horizontal con la tabla.
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text("Ventas — Estación Mascotera", 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Exportado el ${fecha.format(new Date())} · ${resumen}`, 40, 56);
  autoTable(doc, {
    startY: 68,
    head: [COLUMNAS],
    body: filas.map(filaTexto),
    foot: [["", "", "", "", "", "", "Total", moneda.format(totalGeneral), "", ""]],
    showFoot: "lastPage",
    styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [31, 41, 55] },
    footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 28 }, 6: { cellWidth: 200 }, 7: { halign: "right", cellWidth: 62 } },
    margin: { left: 40, right: 40 },
  });
  const pdf = doc.output("arraybuffer");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}.pdf"`,
    },
  });
}
