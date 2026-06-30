"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { registrarLog } from "@/lib/log";
import { CanalVenta } from "@prisma/client";

function parseCostos(formData: FormData) {
  const conceptos = formData.getAll("costoConcepto").map((v) => v.toString().trim());
  const modos = formData.getAll("costoModo").map((v) => v.toString());
  const valores = formData.getAll("costoValor").map((v) => Number(v) || 0);
  const incluyeEnvios = formData.getAll("costoIncluyeEnvio").map((v) => v.toString());

  return conceptos
    .map((concepto, i) => ({
      concepto,
      esPorcentaje: modos[i] === "PORCENTAJE",
      valor: valores[i],
      incluyeEnvio: incluyeEnvios[i] === "on",
    }))
    .filter((c) => c.concepto && c.valor);
}

function calcularMontoCosto(
  costo: { esPorcentaje: boolean; valor: number; incluyeEnvio: boolean },
  subtotalProductos: number,
  costoEnvio: number
) {
  const base = subtotalProductos + (costo.incluyeEnvio ? costoEnvio : 0);
  return costo.esPorcentaje ? (base * costo.valor) / 100 : costo.valor;
}

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
  const detalleConsignacionIds = formData.getAll("detalleConsignacionId").map((v) => v.toString());

  const items = productoIds
    .map((productoId, i) => ({
      productoId,
      cantidad: cantidades[i],
      descuentoPorcentaje: descuentos[i],
      // Precio bruto del producto: la rentabilidad se calcula sobre este valor,
      // sin restar descuentos por medio de pago (ej: efectivo).
      precioVentaUnitario: precios[i],
      detalleConsignacionId: detalleConsignacionIds[i] ? Number(detalleConsignacionIds[i]) : null,
    }))
    .filter((item) => item.productoId && item.cantidad > 0);

  if (items.length === 0) throw new Error("Agregá al menos un producto.");

  const costos = parseCostos(formData);
  const subtotalProductos = items.reduce(
    (acc, it) => acc + it.cantidad * it.precioVentaUnitario * (1 - it.descuentoPorcentaje / 100),
    0
  );

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const producto = await tx.producto.findUniqueOrThrow({ where: { id: item.productoId } });
      if (item.cantidad > producto.stockActual) {
        throw new Error(`No hay suficiente stock de "${producto.nombre}" (disponible: ${producto.stockActual}).`);
      }
      if (item.detalleConsignacionId) {
        const detalle = await tx.detalleConsignacion.findUniqueOrThrow({ where: { id: item.detalleConsignacionId } });
        const disponible = detalle.cantidad - detalle.cantidadVendida;
        if (item.cantidad > disponible) {
          throw new Error(`Solo hay ${disponible} unidades disponibles de "${producto.nombre}" en esa consignación.`);
        }
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
      include: { cliente: true, detalles: true },
    });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const detalleVenta = venta.detalles[i];

      await tx.producto.update({
        where: { id: item.productoId },
        data: { stockActual: { decrement: item.cantidad } },
      });

      if (item.detalleConsignacionId) {
        await tx.ventaConsignacion.create({
          data: {
            detalleConsignacionId: item.detalleConsignacionId,
            cantidad: item.cantidad,
            precioVentaReal: item.precioVentaUnitario,
            facturado,
            numeroFactura,
            fecha: fechaVenta,
            detalleVentaId: detalleVenta.id,
          },
        });
        await tx.detalleConsignacion.update({
          where: { id: item.detalleConsignacionId },
          data: { cantidadVendida: { increment: item.cantidad } },
        });
      }
    }

    for (const costo of costos) {
      const montoCalculado = calcularMontoCosto(costo, subtotalProductos, costoEnvio);
      await tx.costoVenta.create({
        data: {
          ventaId: venta.id,
          concepto: costo.concepto,
          esPorcentaje: costo.esPorcentaje,
          valor: costo.valor,
          incluyeEnvio: costo.incluyeEnvio,
          montoCalculado,
        },
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

  const detalleIdsRaw = formData.getAll("detalleId").map((v) => v.toString());
  const productoIdsRaw = formData.getAll("productoId").map((v) => v.toString());
  const cantidades = formData.getAll("cantidad").map((v) => Number(v));
  const precios = formData.getAll("precioVentaUnitario").map((v) => Number(v));
  const descuentos = formData.getAll("descuentoPorcentaje").map((v) => Number(v) || 0);
  const detalleConsignacionIdsRaw = formData.getAll("detalleConsignacionId").map((v) => v.toString());

  const costos = parseCostos(formData);

  await prisma.$transaction(async (tx) => {
    const detallesActuales = await tx.detalleVenta.findMany({
      where: { ventaId: id },
      include: { ventaConsignacion: true },
    });
    const actualesPorId = new Map(detallesActuales.map((d) => [d.id, d]));
    const idsEnviados = new Set(detalleIdsRaw.filter(Boolean).map(Number));

    // Quitar ítems removidos en el formulario: revierte stock y vínculo de consignación
    for (const actual of detallesActuales) {
      if (idsEnviados.has(actual.id)) continue;
      if (actual.ventaConsignacion) {
        if (actual.ventaConsignacion.liquidacionId) {
          throw new Error("No se puede quitar: esta venta ya fue liquidada con el socio.");
        }
        await tx.detalleConsignacion.update({
          where: { id: actual.ventaConsignacion.detalleConsignacionId },
          data: { cantidadVendida: { decrement: actual.ventaConsignacion.cantidad } },
        });
        await tx.ventaConsignacion.delete({ where: { id: actual.ventaConsignacion.id } });
      }
      await tx.producto.update({
        where: { id: actual.productoId },
        data: { stockActual: { increment: actual.cantidad } },
      });
      await tx.detalleVenta.delete({ where: { id: actual.id } });
    }

    const detallesFinales: { cantidad: number; precioVentaUnitario: number; descuentoPorcentaje: number }[] = [];

    for (let i = 0; i < cantidades.length; i++) {
      const cantidad = cantidades[i];
      const precio = precios[i];
      const descuento = descuentos[i] || 0;
      if (!cantidad || cantidad <= 0 || !precio || precio < 0) continue;

      const detalleIdRaw = detalleIdsRaw[i];
      if (detalleIdRaw) {
        // Ítem ya existente: actualizar cantidad/precio/descuento
        const actual = actualesPorId.get(Number(detalleIdRaw));
        if (!actual) continue;

        const deltaCantidad = cantidad - actual.cantidad;

        if (actual.ventaConsignacion) {
          if (actual.ventaConsignacion.liquidacionId) {
            throw new Error("No se puede modificar: esta venta ya fue liquidada con el socio.");
          }
          if (deltaCantidad !== 0) {
            const detalleConsig = await tx.detalleConsignacion.findUniqueOrThrow({
              where: { id: actual.ventaConsignacion.detalleConsignacionId },
            });
            const disponible = detalleConsig.cantidad - detalleConsig.cantidadVendida;
            if (deltaCantidad > disponible) {
              throw new Error(`Solo hay ${disponible} unidades disponibles en esa consignación.`);
            }
            await tx.detalleConsignacion.update({
              where: { id: detalleConsig.id },
              data: { cantidadVendida: { increment: deltaCantidad } },
            });
          }
          await tx.ventaConsignacion.update({
            where: { id: actual.ventaConsignacion.id },
            data: { cantidad, precioVentaReal: precio },
          });
        }

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
          data: { cantidad, precioVentaUnitario: precio, descuentoPorcentaje: descuento },
        });

        detallesFinales.push({ cantidad, precioVentaUnitario: precio, descuentoPorcentaje: descuento });
      } else {
        // Ítem nuevo agregado en esta edición
        const productoId = Number(productoIdsRaw[i]);
        if (!productoId) continue;

        const producto = await tx.producto.findUniqueOrThrow({ where: { id: productoId } });
        if (cantidad > producto.stockActual) {
          throw new Error(`No hay suficiente stock de "${producto.nombre}" (disponible: ${producto.stockActual}).`);
        }

        const detalleConsignacionId = detalleConsignacionIdsRaw[i] ? Number(detalleConsignacionIdsRaw[i]) : null;
        if (detalleConsignacionId) {
          const detalleConsig = await tx.detalleConsignacion.findUniqueOrThrow({ where: { id: detalleConsignacionId } });
          const disponible = detalleConsig.cantidad - detalleConsig.cantidadVendida;
          if (cantidad > disponible) {
            throw new Error(`Solo hay ${disponible} unidades disponibles de "${producto.nombre}" en esa consignación.`);
          }
        }

        const nuevoDetalle = await tx.detalleVenta.create({
          data: { ventaId: id, productoId, cantidad, precioVentaUnitario: precio, descuentoPorcentaje: descuento },
        });

        await tx.producto.update({
          where: { id: productoId },
          data: { stockActual: { decrement: cantidad } },
        });

        if (detalleConsignacionId) {
          await tx.ventaConsignacion.create({
            data: {
              detalleConsignacionId,
              cantidad,
              precioVentaReal: precio,
              facturado,
              numeroFactura,
              detalleVentaId: nuevoDetalle.id,
            },
          });
          await tx.detalleConsignacion.update({
            where: { id: detalleConsignacionId },
            data: { cantidadVendida: { increment: cantidad } },
          });
        }

        detallesFinales.push({ cantidad, precioVentaUnitario: precio, descuentoPorcentaje: descuento });
      }
    }

    if (detallesFinales.length === 0) throw new Error("La venta debe tener al menos un producto.");

    // Costos de cobranza: se reemplazan por completo con lo enviado, lo que permite
    // editarlos de forma retroactiva en ventas ya cargadas.
    await tx.costoVenta.deleteMany({ where: { ventaId: id } });
    const subtotalProductos = detallesFinales.reduce(
      (acc, d) => acc + d.cantidad * d.precioVentaUnitario * (1 - d.descuentoPorcentaje / 100),
      0
    );
    for (const costo of costos) {
      const montoCalculado = calcularMontoCosto(costo, subtotalProductos, costoEnvio);
      await tx.costoVenta.create({
        data: {
          ventaId: id,
          concepto: costo.concepto,
          esPorcentaje: costo.esPorcentaje,
          valor: costo.valor,
          incluyeEnvio: costo.incluyeEnvio,
          montoCalculado,
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
    const detalles = await tx.detalleVenta.findMany({
      where: { ventaId: id },
      include: { ventaConsignacion: true },
    });
    for (const d of detalles) {
      if (d.ventaConsignacion) {
        if (d.ventaConsignacion.liquidacionId) {
          throw new Error("No se puede eliminar: esta venta ya fue liquidada con el socio.");
        }
        await tx.detalleConsignacion.update({
          where: { id: d.ventaConsignacion.detalleConsignacionId },
          data: { cantidadVendida: { decrement: d.ventaConsignacion.cantidad } },
        });
        await tx.ventaConsignacion.delete({ where: { id: d.ventaConsignacion.id } });
      }
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
