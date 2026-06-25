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

  // Si ENTREGAMOS: mover stock de "disponible" a "en consignación"
  if (direccion === "ENTREGAMOS") {
    for (let i = 0; i < cantidades.length; i++) {
      if (productoIds[i]) {
        await prisma.producto.update({
          where: { id: Number(productoIds[i]) },
          data: {
            stockActual: { decrement: cantidades[i] },
            stockEnConsignacion: { increment: cantidades[i] },
          },
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
  const facturado = formData.get("facturado") === "on";
  const numeroFactura = formData.get("numeroFactura")?.toString().trim() || null;

  const detalle = await prisma.detalleConsignacion.findUnique({
    where: { id: detalleId },
    include: { consignacion: true },
  });
  if (!detalle) throw new Error("Detalle no encontrado.");

  const disponible = detalle.cantidad - detalle.cantidadVendida;
  if (cantidad > disponible) throw new Error(`Solo hay ${disponible} unidades disponibles.`);

  await prisma.$transaction(async (tx) => {
    await tx.ventaConsignacion.create({
      data: { detalleConsignacionId: detalleId, cantidad, precioVentaReal, facturado, numeroFactura },
    });
    await tx.detalleConsignacion.update({
      where: { id: detalleId },
      data: { cantidadVendida: { increment: cantidad } },
    });
    // Si ENTREGAMOS y el socio vendió: bajar stockEnConsignacion (ya salió del stock disponible al crear la consignación)
    if (detalle.consignacion.direccion === "ENTREGAMOS" && detalle.productoId) {
      await tx.producto.update({
        where: { id: detalle.productoId },
        data: { stockEnConsignacion: { decrement: cantidad } },
      });
    }
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

export async function eliminarVentaConsignacion(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));

  const venta = await prisma.ventaConsignacion.findUnique({
    where: { id },
    include: { detalle: { include: { consignacion: true } } },
  });
  if (!venta) throw new Error("Venta no encontrada.");

  await prisma.$transaction(async (tx) => {
    await tx.ventaConsignacion.delete({ where: { id } });
    await tx.detalleConsignacion.update({
      where: { id: venta.detalleConsignacionId },
      data: { cantidadVendida: { decrement: venta.cantidad } },
    });
    if (venta.detalle.consignacion.direccion === "ENTREGAMOS" && venta.detalle.productoId) {
      await tx.producto.update({
        where: { id: venta.detalle.productoId },
        data: { stockEnConsignacion: { increment: venta.cantidad } },
      });
    }
  });

  revalidatePath(`/consignaciones/${venta.detalle.consignacionId}`);
}

export async function actualizarVentaConsignacion(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const precioVentaReal = Number(formData.get("precioVentaReal"));
  const cantidad = Number(formData.get("cantidad"));
  const facturado = formData.get("facturado") === "on";
  const numeroFactura = formData.get("numeroFactura")?.toString().trim() || null;

  const venta = await prisma.ventaConsignacion.findUnique({
    where: { id },
    include: { detalle: { include: { consignacion: true } } },
  });
  if (!venta) throw new Error("Venta no encontrada.");

  const otrasCantidades = await prisma.ventaConsignacion.aggregate({
    where: { detalleConsignacionId: venta.detalleConsignacionId, id: { not: id } },
    _sum: { cantidad: true },
  });
  const disponible = venta.detalle.cantidad - (Number(otrasCantidades._sum.cantidad) ?? 0);
  if (cantidad > disponible) throw new Error(`Máximo disponible: ${disponible}`);

  const diferenciaCantidad = cantidad - venta.cantidad;

  await prisma.$transaction(async (tx) => {
    await tx.ventaConsignacion.update({
      where: { id },
      data: { precioVentaReal, cantidad, facturado, numeroFactura },
    });
    await tx.detalleConsignacion.update({
      where: { id: venta.detalleConsignacionId },
      data: { cantidadVendida: { increment: diferenciaCantidad } },
    });
    if (venta.detalle.consignacion.direccion === "ENTREGAMOS" && venta.detalle.productoId) {
      await tx.producto.update({
        where: { id: venta.detalle.productoId },
        data: { stockEnConsignacion: { decrement: diferenciaCantidad } },
      });
    }
  });

  revalidatePath(`/consignaciones/${venta.detalle.consignacionId}`);
}

export async function cerrarConsignacion(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.consignacion.update({ where: { id }, data: { estado: "CERRADA" } });
  revalidatePath(`/consignaciones/${id}`);
  revalidatePath("/consignaciones");
}

export async function registrarPagoLiquidacion(formData: FormData) {
  await requireAdmin();
  const liquidacionId = Number(formData.get("liquidacionId"));
  const monto = Number(formData.get("monto"));
  const notas = formData.get("notas")?.toString().trim() || null;
  const fecha = new Date(formData.get("fecha")?.toString() ?? new Date().toISOString());

  if (!monto || monto <= 0) throw new Error("El monto debe ser mayor a 0.");

  await prisma.$transaction(async (tx) => {
    await tx.pagoLiquidacion.create({ data: { liquidacionId, monto, notas, fecha } });

    // Verificar si el total pagado cubre el saldo
    const liq = await tx.liquidacionConsignacion.findUnique({
      where: { id: liquidacionId },
      include: { pagos: true },
    });
    if (!liq) throw new Error("Liquidación no encontrada.");

    const totalPagado = liq.pagos.reduce((s, p) => s + Number(p.monto), 0);
    if (totalPagado >= Math.abs(Number(liq.saldo))) {
      await tx.liquidacionConsignacion.update({
        where: { id: liquidacionId },
        data: { pagado: true, fechaPago: new Date() },
      });
    }
  });

  revalidatePath(`/consignaciones/liquidaciones/${liquidacionId}`);
  revalidatePath("/consignaciones/liquidaciones");
}

export async function eliminarPagoLiquidacion(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const pago = await prisma.pagoLiquidacion.findUnique({ where: { id }, include: { liquidacion: true } });
  if (!pago) throw new Error("Pago no encontrado.");

  await prisma.$transaction(async (tx) => {
    await tx.pagoLiquidacion.delete({ where: { id } });
    // Recalcular si sigue pagada
    const liq = await tx.liquidacionConsignacion.findUnique({
      where: { id: pago.liquidacionId },
      include: { pagos: true },
    });
    if (!liq) return;
    const totalPagado = liq.pagos.reduce((s, p) => s + Number(p.monto), 0);
    if (totalPagado < Math.abs(Number(liq.saldo))) {
      await tx.liquidacionConsignacion.update({
        where: { id: pago.liquidacionId },
        data: { pagado: false, fechaPago: null },
      });
    }
  });

  revalidatePath(`/consignaciones/liquidaciones/${pago.liquidacionId}`);
}
