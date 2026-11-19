import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { puedeVer } from "@/lib/permissions";
import { generarExportacion, leerFormato, normalizarBusqueda } from "@/lib/exportar";

// Exportar Proveedores en PDF, XLS o DOC, con la búsqueda de la pantalla (q = nombre o dirección).
// Alcanza con tener la sección Proveedores.

export async function GET(req: NextRequest) {
  if (!(await puedeVer("PROVEEDORES"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const formato = leerFormato(sp.get("formato"));
  if (!formato) return NextResponse.json({ error: "Formato inválido (pdf, xls o doc)" }, { status: 400 });

  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: "asc" },
    select: {
      nombre: true,
      contacto: true,
      email: true,
      cuit: true,
      alias: true,
      cbu: true,
      direccion: true,
      accountManager: true,
      horarios: true,
    },
  });

  const q = normalizarBusqueda(sp.get("q")?.trim() ?? "");
  const filtrados = proveedores.filter((p) => normalizarBusqueda(`${p.nombre} ${p.direccion ?? ""}`).includes(q));

  const filas = filtrados.map((p) => [
    p.nombre,
    p.contacto ?? "",
    p.email ?? "",
    p.cuit ?? "",
    p.alias ?? "",
    p.cbu ?? "",
    p.direccion ?? "",
    p.accountManager ?? "",
    p.horarios ?? "",
  ]);

  return generarExportacion({
    formato,
    titulo: "Proveedores",
    nombreArchivo: "proveedores",
    columnas: [
      { titulo: "Proveedor", ancho: 24 },
      { titulo: "Teléfono", ancho: 16 },
      { titulo: "Email", ancho: 28 },
      { titulo: "CUIT", ancho: 15 },
      { titulo: "Alias", ancho: 20 },
      { titulo: "CBU/CVU", ancho: 24 },
      { titulo: "Dirección", ancho: 36 },
      { titulo: "Account manager", ancho: 20 },
      { titulo: "Horarios", ancho: 24 },
    ],
    filas,
    resumen: `${filas.length} proveedor${filas.length !== 1 ? "es" : ""}`,
  });
}
