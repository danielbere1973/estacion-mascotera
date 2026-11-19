import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

// Exportación de listados a PDF, XLS o DOC (botón Exportar de Ventas, Gastos, Clientes y Proveedores).

export type FormatoExportacion = "pdf" | "xls" | "doc";

export function leerFormato(valor: string | null): FormatoExportacion | null {
  return valor === "pdf" || valor === "xls" || valor === "doc" ? valor : null;
}

export type ColumnaExportacion = {
  titulo: string;
  ancho?: number; // ancho en caracteres para Excel
  moneda?: boolean; // valor numérico que se muestra como $ (en Excel queda como número)
  anchoPdf?: number; // ancho fijo en puntos para el PDF
};

type Celda = string | number | null;

export const formatoFecha = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});
const formatoMoneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

function escaparHtml(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function generarExportacion({
  formato,
  titulo,
  nombreArchivo,
  columnas,
  filas,
  resumen,
  pie,
}: {
  formato: FormatoExportacion;
  titulo: string;
  nombreArchivo: string; // sin extensión ni fecha
  columnas: ColumnaExportacion[];
  filas: Celda[][];
  resumen?: string; // línea debajo del título, ej. "12 ventas · Total $ 1.000"
  pie?: Celda[]; // fila de totales al final
}): NextResponse {
  // Fecha de hoy en Argentina (AAAA-MM-DD) para el nombre del archivo.
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const archivo = `${nombreArchivo}-${hoy}`;
  const subtitulo = `Exportado el ${formatoFecha.format(new Date())}${resumen ? ` · ${resumen}` : ""}`;
  const texto = (valor: Celda, i: number) =>
    valor == null ? "" : columnas[i]?.moneda && typeof valor === "number" ? formatoMoneda.format(valor) : String(valor);
  const filaTexto = (fila: Celda[]) => fila.map(texto);

  if (formato === "xls") {
    const redondear = (fila: Celda[]) =>
      fila.map((v, i) => (columnas[i]?.moneda && typeof v === "number" ? Math.round(v * 100) / 100 : v ?? ""));
    const hoja = XLSX.utils.aoa_to_sheet([
      columnas.map((c) => c.titulo),
      ...filas.map(redondear),
      ...(pie ? [[], redondear(pie)] : []),
    ]);
    hoja["!cols"] = columnas.map((c) => ({ wch: c.ancho ?? 16 }));
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, titulo.slice(0, 31));
    const buffer = XLSX.write(libro, { type: "buffer", bookType: "biff8" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": `attachment; filename="${archivo}.xls"`,
      },
    });
  }

  if (formato === "doc") {
    // Documento HTML con extensión .doc: Word lo abre como documento (horizontal).
    const celdas = (fila: Celda[], etiqueta: "td" | "th") =>
      filaTexto(fila)
        .map((v, i) => `<${etiqueta}${columnas[i]?.moneda ? ' class="num"' : ""}>${escaparHtml(v)}</${etiqueta}>`)
        .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  @page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 1.5cm; }
  div.Section1 { page: Section1; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 9pt; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 3pt 4pt; vertical-align: top; }
  th { background: #E5E7EB; text-align: left; }
  .num { text-align: right; white-space: nowrap; }
  tr.pie td { font-weight: bold; background: #F3F4F6; }
</style></head>
<body><div class="Section1">
<h2>${escaparHtml(titulo)} — Estación Mascotera</h2>
<p>${escaparHtml(subtitulo)}</p>
<table>
<tr>${columnas.map((c) => `<th>${escaparHtml(c.titulo)}</th>`).join("")}</tr>
${filas.map((f) => `<tr>${celdas(f, "td")}</tr>`).join("\n")}
${pie ? `<tr class="pie">${celdas(pie, "td")}</tr>` : ""}
</table>
</div></body></html>`;
    return new NextResponse("﻿" + html, {
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="${archivo}.doc"`,
      },
    });
  }

  // PDF horizontal A4 con la tabla.
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(`${titulo} — Estación Mascotera`, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(subtitulo, 40, 56);
  autoTable(doc, {
    startY: 68,
    head: [columnas.map((c) => c.titulo)],
    body: filas.map(filaTexto),
    ...(pie ? { foot: [filaTexto(pie)], showFoot: "lastPage" as const } : {}),
    styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [31, 41, 55] },
    footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: "bold" },
    columnStyles: Object.fromEntries(
      columnas.map((c, i) => [
        i,
        { ...(c.moneda ? { halign: "right" as const } : {}), ...(c.anchoPdf ? { cellWidth: c.anchoPdf } : {}) },
      ])
    ),
    margin: { left: 40, right: 40 },
  });
  return new NextResponse(new Uint8Array(doc.output("arraybuffer")), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${archivo}.pdf"`,
    },
  });
}

// Mismo criterio que los buscadores de Clientes y Proveedores: sin mayúsculas ni acentos.
export function normalizarBusqueda(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
