import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { puedeVer } from "@/lib/permissions";
import { direccionCompleta, segundaDireccion } from "@/lib/direccion";
import { generarExportacion, leerFormato, normalizarBusqueda } from "@/lib/exportar";

// Exportar la base de Clientes en PDF, XLS o DOC, con las búsquedas de la pantalla
// (q = nombre/familia, dir = dirección). Alcanza con tener la sección Clientes.

export async function GET(req: NextRequest) {
  if (!(await puedeVer("CLIENTES"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const formato = leerFormato(sp.get("formato"));
  if (!formato) return NextResponse.json({ error: "Formato inválido (pdf, xls o doc)" }, { status: 400 });

  const clientes = await prisma.cliente.findMany({
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    include: { _count: { select: { ventas: true, miembrosFamilia: true } } },
  });

  // Familia = nombre del referente (mismo criterio que la lista).
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const datos = clientes.map((c) => {
    const ref = c.familiaId ? porId.get(c.familiaId) : c._count.miembrosFamilia > 0 ? c : undefined;
    return {
      c,
      familia: ref ? `${ref.apellido}, ${ref.nombre}` : "",
      direccion: direccionCompleta(c),
      direccion2: direccionCompleta(segundaDireccion(c)),
    };
  });

  const q = normalizarBusqueda(sp.get("q")?.trim() ?? "");
  const qDir = normalizarBusqueda(sp.get("dir")?.trim() ?? "");
  const filtrados = datos.filter(
    (d) =>
      normalizarBusqueda(`${d.c.nombre} ${d.c.apellido} ${d.familia}`).includes(q) &&
      normalizarBusqueda(`${d.direccion} ${d.direccion2}`).includes(qDir)
  );

  const filas = filtrados.map((d) => [
    `${d.c.apellido}, ${d.c.nombre}`,
    d.familia,
    d.c.telefono,
    d.c.email ?? "",
    d.direccion,
    d.direccion2,
    d.c.cuit ?? "",
    d.c.dni ?? "",
    d.c._count.ventas,
  ]);

  return generarExportacion({
    formato,
    titulo: "Clientes",
    nombreArchivo: "clientes",
    columnas: [
      { titulo: "Cliente", ancho: 26 },
      { titulo: "Familia", ancho: 24 },
      { titulo: "Teléfono", ancho: 16 },
      { titulo: "Email", ancho: 28 },
      { titulo: "Dirección", ancho: 45, anchoPdf: 150 },
      { titulo: "Dirección #2", ancho: 45, anchoPdf: 110 },
      { titulo: "CUIT", ancho: 15 },
      { titulo: "DNI", ancho: 12 },
      { titulo: "Ventas", ancho: 8 },
    ],
    filas,
    resumen: `${filas.length} cliente${filas.length !== 1 ? "s" : ""}`,
  });
}
