"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CanalVenta } from "@prisma/client";

export async function crearVenta(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

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
    await tx.venta.create({
      data: {
        clienteId: Number(clienteId),
        canalVenta,
        medioPago,
        costoEnvio,
        facturado,
        numeroFactura,
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
    });

    for (const item of items) {
      await tx.producto.update({
        where: { id: item.productoId },
        data: { stockActual: { decrement: item.cantidad } },
      });
    }
  });

  revalidatePath("/ventas");
  revalidatePath("/inventario");
  revalidatePath("/");
  redirect("/ventas");
}
