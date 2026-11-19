import { NextRequest, NextResponse } from "next/server";
import { perfilAcceso, puedeVer } from "@/lib/permissions";
import { formatoFecha, generarExportacion, leerFormato } from "@/lib/exportar";
import { ESTADO_LABEL, formatoDuracion, traerRecorridos } from "@/lib/recorridos-logistica";

const hora = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

// Exportar Logística > Costos/KM (con los filtros aplicados) en PDF, XLS o DOC.
export async function GET(req: NextRequest) {
  if (!(await puedeVer("LOGISTICA")) || (await perfilAcceso()).proveedores) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const formato = leerFormato(sp.get("formato"));
  if (!formato) return NextResponse.json({ error: "Formato inválido (pdf, xls o doc)" }, { status: 400 });

  const recorridos = await traerRecorridos({
    desde: sp.get("desde") ?? undefined,
    hasta: sp.get("hasta") ?? undefined,
    usuarioId: sp.get("usuarioId") ?? undefined,
  });
  const kmTotal = recorridos.reduce((acc, r) => acc + r.km, 0);
  const costoTotal = recorridos.reduce((acc, r) => acc + r.costo, 0);
  const km = (n: number) => Math.round(n * 10) / 10;

  return generarExportacion({
    formato,
    titulo: "Costos por km",
    nombreArchivo: "costos-km",
    columnas: [
      { titulo: "Fecha", ancho: 11 },
      { titulo: "Cliente", ancho: 26 },
      { titulo: "Manejó", ancho: 20 },
      { titulo: "Auto", ancho: 20 },
      { titulo: "Horario", ancho: 14 },
      { titulo: "Duración", ancho: 12 },
      { titulo: "Km", ancho: 8 },
      { titulo: "$ por km", ancho: 10, moneda: true },
      { titulo: "Costo estimado", ancho: 16, moneda: true },
      { titulo: "Estado", ancho: 12 },
    ],
    filas: recorridos.map((r) => [
      formatoFecha.format(r.inicio),
      r.cliente,
      r.usuario,
      r.auto ?? "",
      `${hora.format(r.inicio)} – ${r.estado === "ACTIVO" ? "en curso" : hora.format(r.fin)}`,
      formatoDuracion(r.minutos),
      km(r.km),
      r.costoPorKm,
      r.costo,
      ESTADO_LABEL[r.estado],
    ]),
    resumen: `${recorridos.length} recorrido${recorridos.length !== 1 ? "s" : ""}`,
    pie: ["", "", "", "", "", "Total", km(kmTotal), "", costoTotal, ""],
  });
}
