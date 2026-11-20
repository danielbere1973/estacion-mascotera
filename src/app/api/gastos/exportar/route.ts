import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { puedeVer } from "@/lib/permissions";
import { formatoFecha, generarExportacion, leerFormato } from "@/lib/exportar";

// Exportar todos los gastos (la pantalla muestra los últimos 50) en PDF, XLS o DOC.
// Alcanza con tener la sección Gastos (también para Solo lectura).

const TIPOS: Record<string, string> = { FIJO: "Fijo", VARIABLE: "Variable", EXCEPCIONAL: "OTC (Excepcional, única vez)" };

export async function GET(req: NextRequest) {
  if (!(await puedeVer("GASTOS"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const formato = leerFormato(req.nextUrl.searchParams.get("formato"));
  if (!formato) return NextResponse.json({ error: "Formato inválido (pdf, xls o doc)" }, { status: 400 });

  const gastos = await prisma.gasto.findMany({
    orderBy: { fechaGasto: "desc" },
    include: {
      usuario: { select: { nombre: true, apellido: true } },
      pagadoPor: { select: { nombre: true, apellido: true } },
    },
  });

  const total = gastos.reduce((acc, g) => acc + Number(g.monto), 0);
  const filas = gastos.map((g) => [
    formatoFecha.format(g.fechaGasto),
    g.categoriaGasto,
    TIPOS[g.tipoGasto ?? (g.esFijo ? "FIJO" : "VARIABLE")] ?? "Variable",
    Number(g.monto),
    g.descripcion ?? "",
    g.usuario ? `${g.usuario.nombre} ${g.usuario.apellido}` : "",
    g.pagadoPor ? `${g.pagadoPor.nombre} ${g.pagadoPor.apellido}` : "",
  ]);

  return generarExportacion({
    formato,
    titulo: "Gastos",
    nombreArchivo: "gastos",
    columnas: [
      { titulo: "Fecha", ancho: 11 },
      { titulo: "Categoría", ancho: 24 },
      { titulo: "Tipo de gasto", ancho: 28 },
      { titulo: "Monto", ancho: 14, moneda: true },
      { titulo: "Notas", ancho: 40, anchoPdf: 220 },
      { titulo: "Cargado por", ancho: 20 },
      { titulo: "Pagado por", ancho: 20 },
    ],
    filas,
    resumen: `${filas.length} gasto${filas.length !== 1 ? "s" : ""}`,
    pie: ["", "", "Total", total, "", "", ""],
  });
}
