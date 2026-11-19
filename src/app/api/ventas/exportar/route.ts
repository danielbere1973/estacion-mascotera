import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { perfilAcceso, puedeVer } from "@/lib/permissions";
import { armarFiltroVentas, leerFiltroVentas } from "@/lib/filtro-ventas";
import { formatoFecha, generarExportacion, leerFormato } from "@/lib/exportar";

// Exportar el listado de Ventas (con los filtros aplicados) en PDF, XLS o DOC.
// Exportar es leer: alcanza con tener la sección Ventas (también para Solo lectura).
// No incluye costos ni ganancias, así sirve igual para usuarios con restricción de proveedores.

const CANAL_LABELS: Record<string, string> = { TIENDANUBE: "Tiendanube", WHATSAPP: "WhatsApp", TELEFONO: "Teléfono" };

export async function GET(req: NextRequest) {
  if (!(await puedeVer("VENTAS"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const formato = leerFormato(sp.get("formato"));
  if (!formato) return NextResponse.json({ error: "Formato inválido (pdf, xls o doc)" }, { status: 400 });

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
    return [
      v.id,
      formatoFecha.format(v.fechaVenta),
      `${v.cliente.apellido}, ${v.cliente.nombre}`,
      v.cliente.cuit || v.cliente.dni || "",
      v.esVentaInterna ? `${canal} (interna)` : v.esMayorista ? `${canal} (mayorista)` : canal,
      v.medioPago,
      v.detalles.map((d) => `${d.cantidad}x ${d.producto.nombre}`).join("; "),
      total,
      v.facturado ? (v.numeroFactura ? `Sí (${v.numeroFactura})` : "Sí") : "No",
      estadoPago,
    ];
  });

  return generarExportacion({
    formato,
    titulo: "Ventas",
    nombreArchivo: "ventas",
    columnas: [
      { titulo: "ID", ancho: 6, anchoPdf: 28 },
      { titulo: "Fecha", ancho: 11 },
      { titulo: "Cliente", ancho: 28 },
      { titulo: "CUIT/DNI", ancho: 15 },
      { titulo: "Canal", ancho: 18 },
      { titulo: "Medio de pago", ancho: 16 },
      { titulo: "Productos", ancho: 60, anchoPdf: 200 },
      { titulo: "Total", ancho: 14, moneda: true, anchoPdf: 62 },
      { titulo: "Facturado", ancho: 16 },
      { titulo: "Estado de pago", ancho: 18 },
    ],
    filas,
    resumen: `${filas.length} venta${filas.length !== 1 ? "s" : ""}`,
    pie: ["", "", "", "", "", "", "Total", totalGeneral, "", ""],
  });
}
