"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { registrarLog } from "@/lib/log";
import { CanalVenta } from "@prisma/client";

export async function crearVenta(formData: FormData) {
  const session = await requireAdmin();

  let clienteId = formData.get("clienteId")?.toString();

  // Alta de cliente nuevo en el mismo formulario
  if (clienteId === "nuevo") {
    const nombre = formData.get("clienteNombre")?.toString().trim();
    const apellido = formData.get("clienteApellido")?.toString().trim();
    const direccion = formData.get("clienteDireccion")?.toString().trim();
    const telefono = formData.get("clienteTelefono")?.toString().trim();
    const email = formData.get("clienteEmail")?.toString().trim();

    if (!nombre || !apellido || !direccion || !telefono) {
      throw new Error("Faltan datos del cliente nuevo.");
    }

    const cliente = await prisma.cliente.create({
      data: { nombre, apellido, direccion, telefono, email: email || null },
    });
    clienteId = String(cliente.id);
  }

  if (!clienteId) throw new Error("Debe seleccionar un cliente.");

  const canalVenta = formData.get("canalVenta")?.toString() as CanalVenta;
  const medioPago = formData.get("medioPago")?.toString().trim();
  const costoEnvio = Number(formData.get("costoEnvio") || 0);
  const facturado = formData.get("facturado") === "on";
  const numeroFactura = formData.get("numeroFactura")?.toString().trim() || null;
  const vendidoPorId = formData.get("vendidoPorId") ? Number(formData.get("vendidoPorId")) : null;
  const cobradoPorId = formData.get("cobradoPorId") ? Number(formData.get("cobradoPorId")) : null;
  const fechaVentaStr = formData.get("fechaVenta")?.toString();
  const fechaVenta = fechaVentaStr ? new Date(fechaVentaStr) : new Date();

  if (!canalVenta || !medioPago) throw new Error("Faltan datos de la venta.");

  const productoIds = formData.getAll("productoId").map((v) => Number(v));
  const cantidades = formData.getAll("cantidad").map((v) => Number(v));
  const precios = formData.getAll("precioVentaUnitario").map((v) => Number(v));
  const descuentos = formData.getAll("descuentoPorcentaje").map((v) => Number(v) || 0);

  const items = productoIds
    .map((productoId, i) => ({
      productoId,
      cantidad: cantidades[i],
      descuentoPorcentaje: descuentos[i],
      // Precio bruto del producto: la rentabilidad se calcula sobre este valor,
      // sin restar descuentos por medio de pago (ej: efectivo).
      precioVentaUnitario: precios[i],
    }))
    .filter((item) => item.productoId && item.cantidad > 0);

  if (items.length === 0) throw new Error("Agregá al menos un producto.");

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const producto = await tx.producto.findUniqueOrThrow({ where: { id: item.productoId } });
      if (item.cantidad > producto.stockActual) {
        throw new Error(`No hay suficiente stock de "${producto.nombre}" (disponible: ${producto.stockActual}).`);
      }
    }

    const venta = await tx.venta.create({
      data: {
        clienteId: Number(clienteId),
        canalVenta,
        medioPago,
        costoEnvio,
        facturado,
        numeroFactura,
        fechaVenta,
        vendidoPorId,
        cobradoPorId,
        usuarioId: Number(session.user.id),
        detalles: {
          create: items.map((item) => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioVentaUnitario: item.precioVentaUnitario,
            descuentoPorcentaje: item.descuentoPorcentaje,
          })),
        },
      },
      include: { cliente: true },
    });

    for (const item of items) {
      await tx.producto.update({
        where: { id: item.productoId },
        data: { stockActual: { decrement: item.cantidad } },
      });
    }

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "CREAR",
      entidad: "VENTA",
      entidadId: venta.id,
      detalle: `Venta a ${venta.cliente.nombre} ${venta.cliente.apellido}`,
    });
  });

  revalidatePath("/ventas");
  revalidatePath("/inventario");
  revalidatePath("/");
  redirect("/ventas");
}

export async function actualizarVenta(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Venta inválida.");

  const canalVenta = formData.get("canalVenta")?.toString() as CanalVenta;
  const medioPago = formData.get("medioPago")?.toString().trim();
  const costoEnvio = Number(formData.get("costoEnvio") || 0);
  const facturado = formData.get("facturado") === "on";
  const numeroFactura = formData.get("numeroFactura")?.toString().trim() || null;

  if (!canalVenta || !medioPago) throw new Error("Faltan datos de la venta.");

  const detalleIds = formData.getAll("detalleId").map((v) => Number(v));
  const cantidades = formData.getAll("cantidad").map((v) => Number(v));
  const precios = formData.getAll("precioVentaUnitario").map((v) => Number(v));
  const descuentos = formData.getAll("descuentoPorcentaje").map((v) => Number(v) || 0);

  await prisma.$transaction(async (tx) => {
    const detallesActuales = await tx.detalleVenta.findMany({ where: { ventaId: id } });
    const actualesPorId = new Map(detallesActuales.map((d) => [d.id, d]));

    for (let i = 0; i < detalleIds.length; i++) {
      const actual = actualesPorId.get(detalleIds[i]);
      if (!actual) continue;

      const nuevaCantidad = cantidades[i];
      if (!nuevaCantidad || nuevaCantidad <= 0) {
        throw new Error("La cantidad debe ser mayor a 0.");
      }

      const deltaCantidad = nuevaCantidad - actual.cantidad;
      if (deltaCantidad !== 0) {
        const producto = await tx.producto.findUniqueOrThrow({ where: { id: actual.productoId } });
        if (deltaCantidad > producto.stockActual) {
          throw new Error(`No hay suficiente stock de "${producto.nombre}" (disponible: ${producto.stockActual}).`);
        }
        await tx.producto.update({
          where: { id: actual.productoId },
          data: { stockActual: { decrement: deltaCantidad } },
        });
      }

      await tx.detalleVenta.update({
        where: { id: actual.id },
        data: {
          cantidad: nuevaCantidad,
          precioVentaUnitario: precios[i],
          descuentoPorcentaje: descuentos[i],
        },
      });
    }

    await tx.venta.update({
      where: { id },
      data: { canalVenta, medioPago, costoEnvio, facturado, numeroFactura },
    });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "ACTUALIZAR",
      entidad: "VENTA",
      entidadId: id,
    });
  });

  revalidatePath("/ventas");
  revalidatePath("/inventario");
  revalidatePath("/");
  redirect("/ventas");
}

export async function eliminarVenta(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Venta inválida.");

  await prisma.$transaction(async (tx) => {
    const venta = await tx.venta.findUniqueOrThrow({ where: { id }, include: { cliente: true } });
    const detalles = await tx.detalleVenta.findMany({ where: { ventaId: id } });
    for (const d of detalles) {
      await tx.producto.update({
        where: { id: d.productoId },
        data: { stockActual: { increment: d.cantidad } },
      });
    }
    await tx.venta.delete({ where: { id } });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "ELIMINAR",
      entidad: "VENTA",
      entidadId: id,
      detalle: `Venta a ${venta.cliente.nombre} ${venta.cliente.apellido}`,
    });
  });

  revalidatePath("/ventas");
  revalidatePath("/inventario");
  revalidatePath("/");
}
