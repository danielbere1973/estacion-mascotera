"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/permissions";
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

  const nuevoSkus = formData.getAll("itemNuevoSku").map(String);
  const nuevoNombres = formData.getAll("itemNuevoNombre").map(String);
  const nuevoMarcas = formData.getAll("itemNuevoMarca").map(String);
  const nuevoCategorias = formData.getAll("itemNuevoCategoria").map(String);
  const nuevoPresentaciones = formData.getAll("itemNuevoPresentacion").map(String);
  const nuevoUnidades = formData.getAll("itemNuevoUnidadMedida").map(String);
  const nuevoContenidos = formData.getAll("itemNuevoContenido").map(String);
  const nuevoProveedorIds = formData.getAll("itemNuevoProveedorId").map(String);

  if (!socioId || !direccion || cantidades.length === 0) throw new Error("Faltan datos.");

  const consignacion = await prisma.$transaction(async (tx) => {
    // Resolver productoId por ítem: el existente seleccionado, o uno recién creado en Inventario.
    const resolvedProductoIds: (number | null)[] = [];
    for (let i = 0; i < cantidades.length; i++) {
      if (productoIds[i]) {
        resolvedProductoIds.push(Number(productoIds[i]));
        continue;
      }
      if (nuevoSkus[i]) {
        if (direccion === "ENTREGAMOS") {
          throw new Error(`No se puede crear un producto nuevo en una consignación ENTREGAMOS (el ítem ${i + 1}): no tenemos ese producto en stock para entregar.`);
        }
        if (!nuevoNombres[i] || !nuevoMarcas[i] || !nuevoCategorias[i] || !nuevoPresentaciones[i]) {
          throw new Error(`Faltan datos del producto nuevo en el ítem ${i + 1}.`);
        }
        const proveedorId = nuevoProveedorIds[i] ? Number(nuevoProveedorIds[i]) : null;
        if (!proveedorId) throw new Error(`Falta el proveedor del producto nuevo en el ítem ${i + 1}.`);
        const nuevo = await tx.producto.create({
          data: {
            sku: nuevoSkus[i],
            nombre: nuevoNombres[i],
            marca: nuevoMarcas[i],
            categoria: nuevoCategorias[i],
            presentacion: nuevoPresentaciones[i] as "BOLSA_CERRADA" | "CAJA_CERRADA" | "INDIVIDUAL",
            unidadMedida: (nuevoUnidades[i] || "UNIDAD") as "KILOGRAMOS" | "GRAMOS" | "LITROS" | "MILILITROS" | "UNIDAD",
            contenido: nuevoContenidos[i] ? Number(nuevoContenidos[i]) : 1,
            proveedorId,
            precioCostoUnitario: costos[i] || 0,
            margenPorcentaje: 30,
            precioVenta: (costos[i] || 0) * 1.3,
            stockActual: 0,
          },
        });
        resolvedProductoIds.push(nuevo.id);
      } else {
        resolvedProductoIds.push(null);
      }
    }

    const creada = await tx.consignacion.create({
      data: {
        socioId, direccion, fecha, notas,
        items: {
          create: cantidades.map((_, i) => ({
            productoId: resolvedProductoIds[i],
            descripcion: descripciones[i] || skus[i] || nuevoNombres[i] || null,
            cantidad: cantidades[i],
            precioCosto: costos[i],
            precioPiso: pisos[i],
          })),
        },
      },
    });

    for (let i = 0; i < cantidades.length; i++) {
      const productoId = resolvedProductoIds[i];
      if (!productoId) continue;
      if (direccion === "ENTREGAMOS") {
        // Mover stock de "disponible" a "en consignación"
        await tx.producto.update({
          where: { id: productoId },
          data: {
            stockActual: { decrement: cantidades[i] },
            stockEnConsignacion: { increment: cantidades[i] },
          },
        });
      } else {
        // RECIBIMOS: la mercadería del socio entra a nuestro stock disponible (como una compra)
        await tx.producto.update({
          where: { id: productoId },
          data: { stockActual: { increment: cantidades[i] } },
        });
      }
    }

    return creada;
  });

  revalidatePath("/consignaciones");
  revalidatePath("/inventario");
  redirect(`/consignaciones/${consignacion.id}`);
}

export async function editarConsignacion(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const direccion = formData.get("direccion")?.toString() as "ENTREGAMOS" | "RECIBIMOS";
  const fecha = new Date(formData.get("fecha")?.toString() ?? new Date().toISOString());
  const notas = formData.get("notas")?.toString().trim() || null;

  if (!direccion) throw new Error("Faltan datos.");

  const cons = await prisma.consignacion.findUniqueOrThrow({ where: { id }, include: { items: true } });

  if (cons.direccion !== direccion) {
    // Si ya hay ventas registradas, el cambio de dirección dejaría el stock/comisiones inconsistentes
    if (cons.items.some((it) => it.cantidadVendida > 0)) {
      throw new Error("No se puede cambiar la dirección: ya hay ventas registradas en esta consignación.");
    }

    await prisma.$transaction(async (tx) => {
      for (const item of cons.items) {
        if (!item.productoId) continue;
        // Revertir el movimiento de stock de la dirección anterior
        if (cons.direccion === "ENTREGAMOS") {
          await tx.producto.update({
            where: { id: item.productoId },
            data: { stockActual: { increment: item.cantidad }, stockEnConsignacion: { decrement: item.cantidad } },
          });
        } else {
          await tx.producto.update({
            where: { id: item.productoId },
            data: { stockActual: { decrement: item.cantidad } },
          });
        }
        // Aplicar el movimiento de stock de la nueva dirección
        if (direccion === "ENTREGAMOS") {
          await tx.producto.update({
            where: { id: item.productoId },
            data: { stockActual: { decrement: item.cantidad }, stockEnConsignacion: { increment: item.cantidad } },
          });
        } else {
          await tx.producto.update({
            where: { id: item.productoId },
            data: { stockActual: { increment: item.cantidad } },
          });
        }
      }
      await tx.consignacion.update({ where: { id }, data: { direccion, fecha, notas } });
    });
  } else {
    await prisma.consignacion.update({ where: { id }, data: { direccion, fecha, notas } });
  }

  revalidatePath(`/consignaciones/${id}`);
}

export async function eliminarConsignacion(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));

  const cons = await prisma.consignacion.findUniqueOrThrow({
    where: { id },
    include: { items: true, pagos: true },
  });

  if (cons.pagos.length > 0 || cons.items.some((it) => it.cantidadVendida > 0)) {
    throw new Error("No se puede eliminar: esta consignación ya tiene ventas o pagos registrados.");
  }

  await prisma.$transaction(async (tx) => {
    for (const item of cons.items) {
      if (!item.productoId) continue;
      if (cons.direccion === "ENTREGAMOS") {
        await tx.producto.update({
          where: { id: item.productoId },
          data: { stockActual: { increment: item.cantidad }, stockEnConsignacion: { decrement: item.cantidad } },
        });
      } else {
        await tx.producto.update({
          where: { id: item.productoId },
          data: { stockActual: { decrement: item.cantidad } },
        });
      }
    }
    await tx.detalleConsignacion.deleteMany({ where: { consignacionId: id } });
    await tx.consignacion.delete({ where: { id } });
  });

  revalidatePath("/consignaciones");
  redirect("/consignaciones");
}

export async function registrarVentaConsignacion(formData: FormData) {
  await requireAuth();
  const detalleId = Number(formData.get("detalleId"));
  const cantidad = Number(formData.get("cantidad"));
  const precioVentaReal = Number(formData.get("precioVentaReal"));
  const facturado = formData.get("facturado") === "on";
  const numeroFactura = formData.get("numeroFactura")?.toString().trim() || null;
  const fechaStr = formData.get("fecha")?.toString();
  const fecha = fechaStr ? new Date(fechaStr) : new Date();

  const detalle = await prisma.detalleConsignacion.findUnique({
    where: { id: detalleId },
    include: { consignacion: true },
  });
  if (!detalle) throw new Error("Detalle no encontrado.");

  const disponible = detalle.cantidad - detalle.cantidadVendida;
  if (cantidad > disponible) throw new Error(`Solo hay ${disponible} unidades disponibles.`);

  await prisma.$transaction(async (tx) => {
    await tx.ventaConsignacion.create({
      data: { detalleConsignacionId: detalleId, cantidad, precioVentaReal, facturado, numeroFactura, fecha },
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
  const consignacionIds = new Set<number>();

  for (const v of ventas) {
    const costo = Number(v.detalle.precioCosto);
    const venta = Number(v.precioVentaReal);
    const montoLiquidar = (costo + (venta - costo) / 3) * v.cantidad;
    if (v.detalle.consignacion.direccion === "ENTREGAMOS") {
      totalACobrarnos += montoLiquidar;
    } else {
      totalACobrarles += montoLiquidar;
    }
    consignacionIds.add(v.detalle.consignacionId);
  }

  // Pagos no liquidados de las consignaciones incluidas
  const pagos = consignacionIds.size > 0
    ? await prisma.pagoConsignacion.findMany({
        where: { liquidacionId: null, consignacionId: { in: Array.from(consignacionIds) } },
        include: { consignacion: { select: { direccion: true } } },
      })
    : [];

  let pagosRecibidos = 0; // pagos en consig ENTREGAMOS (ellos nos pagaron)
  let pagosRealizados = 0; // pagos en consig RECIBIMOS (nosotros les pagamos)
  for (const p of pagos) {
    if (p.consignacion.direccion === "ENTREGAMOS") pagosRecibidos += Number(p.monto);
    else pagosRealizados += Number(p.monto);
  }

  // Saldo neto real descontando pagos ya realizados
  const saldo = (totalACobrarnos - pagosRecibidos) - (totalACobrarles - pagosRealizados);

  const liquidacion = await prisma.$transaction(async (tx) => {
    const liq = await tx.liquidacionConsignacion.create({
      data: { socioId, fechaDesde, fechaHasta, totalACobrarnos, totalACobrarles, saldo, notas },
    });
    await tx.ventaConsignacion.updateMany({
      where: { id: { in: ventas.map(v => v.id) } },
      data: { liquidacionId: liq.id },
    });
    if (pagos.length > 0) {
      await tx.pagoConsignacion.updateMany({
        where: { id: { in: pagos.map(p => p.id) } },
        data: { liquidacionId: liq.id },
      });
    }
    return liq;
  });

  revalidatePath("/consignaciones/liquidaciones");
  redirect(`/consignaciones/liquidaciones/${liquidacion.id}`);
}

export async function anularLiquidacion(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const socioId = Number(formData.get("socioId"));

  await prisma.$transaction(async (tx) => {
    await tx.consignacion.updateMany({ where: { liquidacionId: id }, data: { liquidacionId: null } });
    await tx.ventaConsignacion.updateMany({ where: { liquidacionId: id }, data: { liquidacionId: null } });
    await tx.pagoConsignacion.updateMany({ where: { liquidacionId: id }, data: { liquidacionId: null } });
    await tx.liquidacionConsignacion.delete({ where: { id } });
  });

  revalidatePath("/consignaciones/liquidaciones");
  revalidatePath(`/consignaciones/cuenta-corriente/${socioId}`);
  redirect("/consignaciones/liquidaciones");
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

export async function registrarPagoConsignacion(formData: FormData) {
  await requireAdmin();
  const consignacionId = Number(formData.get("consignacionId"));
  const monto = Number(formData.get("monto"));
  const notas = formData.get("notas")?.toString().trim() || null;
  const fecha = new Date(formData.get("fecha")?.toString() ?? new Date().toISOString());

  if (!monto || monto <= 0) throw new Error("El monto debe ser mayor a 0.");

  // Calcular total owed de la consignación
  const cons = await prisma.consignacion.findUnique({
    where: { id: consignacionId },
    include: {
      items: { include: { ventas: true } },
      pagos: true,
    },
  });
  if (!cons) throw new Error("Consignación no encontrada.");

  const totalOwe = cons.items.reduce((s, item) =>
    s + item.ventas.reduce((sv, v) => {
      const costo = Number(item.precioCosto);
      const ganancia = Number(v.precioVentaReal) - costo;
      return sv + (costo + ganancia / 3) * v.cantidad;
    }, 0), 0);

  const totalPagado = cons.pagos.reduce((s, p) => s + Number(p.monto), 0);
  const pendiente = totalOwe - totalPagado;

  // Se permite pagar de más (ej: se entregó todo al socio); el saldo negativo queda como deuda del socio hacia nosotros

  await prisma.pagoConsignacion.create({ data: { consignacionId, monto, notas, fecha } });

  revalidatePath(`/consignaciones/${consignacionId}`);
}

export async function eliminarPagoConsignacion(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const pago = await prisma.pagoConsignacion.findUnique({ where: { id } });
  if (!pago) throw new Error("Pago no encontrado.");
  await prisma.pagoConsignacion.delete({ where: { id } });
  revalidatePath(`/consignaciones/${pago.consignacionId}`);
}
