"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ---------------------------------------------------------------------------
// Socios
// ---------------------------------------------------------------------------

export async function crearSocio(formData: FormData) {
  await requireAdmin();
  const nombre = formData.get("nombre")?.toString().trim();
  const contacto = formData.get("contacto")?.toString().trim() || null;
  const notas = formData.get("notas")?.toString().trim() || null;
  const proveedorIdStr = formData.get("proveedorId")?.toString();
  const proveedorId = proveedorIdStr ? Number(proveedorIdStr) : null;
  if (!nombre) throw new Error("El nombre es obligatorio.");
  await prisma.socioConsignacion.create({ data: { nombre, contacto, notas, proveedorId } });
  revalidatePath("/consignaciones/socios");
  redirect("/consignaciones/socios");
}

export async function actualizarSocio(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const nombre = formData.get("nombre")?.toString().trim();
  const contacto = formData.get("contacto")?.toString().trim() || null;
  const notas = formData.get("notas")?.toString().trim() || null;
  const proveedorIdStr = formData.get("proveedorId")?.toString();
  const proveedorId = proveedorIdStr ? Number(proveedorIdStr) : null;
  if (!nombre) throw new Error("El nombre es obligatorio.");
  await prisma.socioConsignacion.update({ where: { id }, data: { nombre, contacto, notas, proveedorId } });
  revalidatePath("/consignaciones/socios");
  redirect("/consignaciones/socios");
}

export async function eliminarSocio(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.socioConsignacion.delete({ where: { id } });
  revalidatePath("/consignaciones/socios");
}

// ---------------------------------------------------------------------------
// Consignaciones (entregas / recepciones)
// ---------------------------------------------------------------------------

export async function crearConsignacion(formData: FormData) {
  await requireAdmin();
  const socioId = Number(formData.get("socioId"));
  const direccion = formData.get("direccion")?.toString() as "ENTREGAMOS" | "RECIBIMOS";
  const fecha = new Date(formData.get("fecha")?.toString() ?? new Date().toISOString());
  const notas = formData.get("notas")?.toString().trim() || null;

  const skus = formData.getAll("itemSku").map(String);
  const descripciones = formData.getAll("itemDescripcion").map(String);
  const cantidades = formData.getAll("itemCantidad").map(Number);
  const costos = formData.getAll("itemCosto").map(Number);
  const pisos = formData.getAll("itemPiso").map(Number);
  const productoIds = formData.getAll("itemProductoId").map(String);

  if (!socioId || !direccion || cantidades.length === 0) throw new Error("Faltan datos.");

  const consignacion = await prisma.consignacion.create({
    data: {
      socioId, direccion, fecha, notas,
      items: {
        create: cantidades.map((_, i) => ({
          productoId: productoIds[i] ? Number(productoIds[i]) : null,
          descripcion: descripciones[i] || skus[i] || null,
          cantidad: cantidades[i],
          precioCosto: costos[i],
          precioPiso: pisos[i],
        })),
      },
    },
  });

  // Si ENTREGAMOS: decrementar stock de nuestros productos
  if (direccion === "ENTREGAMOS") {
    for (let i = 0; i < cantidades.length; i++) {
      if (productoIds[i]) {
        await prisma.producto.update({
          where: { id: Number(productoIds[i]) },
          data: { stockActual: { decrement: cantidades[i] } },
        });
      }
    }
  }

  revalidatePath("/consignaciones");
  redirect(`/consignaciones/${consignacion.id}`);
}

export async function registrarVentaConsignacion(formData: FormData) {
  await requireAdmin();
  const detalleId = Number(formData.get("detalleId"));
  const cantidad = Number(formData.get("cantidad"));
  const precioVentaReal = Number(formData.get("precioVentaReal"));

  const detalle = await prisma.detalleConsignacion.findUnique({
    where: { id: detalleId },
    include: { consignacion: true },
  });
  if (!detalle) throw new Error("Detalle no encontrado.");

  const disponible = detalle.cantidad - detalle.cantidadVendida;
  if (cantidad > disponible) throw new Error(`Solo hay ${disponible} unidades disponibles.`);

  await prisma.$transaction(async (tx) => {
    await tx.ventaConsignacion.create({
      data: { detalleConsignacionId: detalleId, cantidad, precioVentaReal },
    });
    await tx.detalleConsignacion.update({
      where: { id: detalleId },
      data: { cantidadVendida: { increment: cantidad } },
    });
    // Si RECIBIMOS y vendemos: no afecta nuestro stock (nunca entró)
    // Si ENTREGAMOS y el socio vendió: tampoco afecta (ya salió al crear la consignación)
  });

  revalidatePath(`/consignaciones/${detalle.consignacionId}`);
}

export async function generarLiquidacion(formData: FormData) {
  await requireAdmin();
  const socioId = Number(formData.get("socioId"));
  const fechaDesde = new Date(formData.get("fechaDesde")?.toString() ?? "");
  const fechaHasta = new Date(formData.get("fechaHasta")?.toString() ?? "");
  const notas = formData.get("notas")?.toString().trim() || null;

  // Ventas no liquidadas del período
  const ventas = await prisma.ventaConsignacion.findMany({
    where: {
      liquidacionId: null,
      fecha: { gte: fechaDesde, lte: fechaHasta },
      detalle: { consignacion: { socioId } },
    },
    include: { detalle: { include: { consignacion: true } } },
  });

  let totalACobrarnos = 0; // ellos nos deben (vendieron nuestros productos - ENTREGAMOS)
  let totalACobrarles = 0; // nosotros les debemos (vendimos sus productos - RECIBIMOS)

  for (const v of ventas) {
    const costo = Number(v.detalle.precioCosto);
    const venta = Number(v.precioVentaReal);
    // Dueño cobra: costo + 1/3 de la ganancia
    const montoLiquidar = (costo + (venta - costo) / 3) * v.cantidad;
    if (v.detalle.consignacion.direccion === "ENTREGAMOS") {
      totalACobrarnos += montoLiquidar;
    } else {
      totalACobrarles += montoLiquidar;
    }
  }

  const saldo = totalACobrarnos - totalACobrarles;

  const liquidacion = await prisma.$transaction(async (tx) => {
    const liq = await tx.liquidacionConsignacion.create({
      data: { socioId, fechaDesde, fechaHasta, totalACobrarnos, totalACobrarles, saldo, notas },
    });
    await tx.ventaConsignacion.updateMany({
      where: { id: { in: ventas.map(v => v.id) } },
      data: { liquidacionId: liq.id },
    });
    return liq;
  });

  revalidatePath("/consignaciones/liquidaciones");
  redirect(`/consignaciones/liquidaciones/${liquidacion.id}`);
}

export async function registrarPagoLiquidacion(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.liquidacionConsignacion.update({
    where: { id },
    data: { pagado: true, fechaPago: new Date() },
  });
  revalidatePath("/consignaciones/liquidaciones");
}
