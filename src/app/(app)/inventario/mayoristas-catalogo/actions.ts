"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { precioMayoristaDe } from "@/lib/mayoristas";
import { registrarVenta } from "@/lib/registrar-venta";
import { estadoStockDe, maximoPorEstado } from "./limites";
import { COMO_NOS_CONOCISTE, MEDIOS_PAGO_MAYORISTA } from "./opciones";

export type ItemCarrito = { productoId: number; cantidad: number };

export type ResultadoCarrito = { ok: true; ventaId: number; total: number } | { ok: false; error: string };

// Confirma el carrito del Catálogo mayorista: crea una venta mayorista (mismo circuito que
// Nueva venta: stock, compras a HYM, tarjeta del Tablero y aviso por Telegram).
// Los precios se recalculan acá con los márgenes actuales, no se toman del navegador.
export async function confirmarCarritoMayorista(datos: {
  clienteId: number;
  medioPago: string;
  comoNosConociste: string;
  items: ItemCarrito[];
}): Promise<ResultadoCarrito> {
  try {
    const session = await requireAdmin("MAYORISTA_CATALOGO");

    const clienteId = Number(datos.clienteId);
    const medioPago = datos.medioPago?.trim();
    if (!clienteId) return { ok: false, error: "Elegí un cliente." };
    if (!(MEDIOS_PAGO_MAYORISTA as readonly string[]).includes(medioPago)) {
      return { ok: false, error: "Elegí un medio de pago: Efectivo, Transferencia o Link de Pago." };
    }
    const comoNosConociste = datos.comoNosConociste?.trim();
    if (!(COMO_NOS_CONOCISTE as readonly string[]).includes(comoNosConociste)) {
      return { ok: false, error: "Elegí cómo nos conociste." };
    }

    // Junta cantidades del mismo producto y descarta las inválidas.
    const cantidadPorProducto = new Map<number, number>();
    for (const item of datos.items ?? []) {
      const productoId = Number(item.productoId);
      const cantidad = Math.floor(Number(item.cantidad));
      if (!productoId || !(cantidad > 0)) continue;
      cantidadPorProducto.set(productoId, (cantidadPorProducto.get(productoId) ?? 0) + cantidad);
    }
    if (cantidadPorProducto.size === 0) return { ok: false, error: "El carrito está vacío." };

    const [cliente, productos, margenes] = await Promise.all([
      prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } }),
      prisma.producto.findMany({
        where: { id: { in: [...cantidadPorProducto.keys()] }, activo: true, tipoProductoMayorista: { not: null } },
        select: {
          id: true,
          nombre: true,
          tipoProductoMayorista: true,
          contenido: true,
          unidadMedida: true,
          precioCostoUnitario: true,
          historialStock: { where: { activo: true }, select: { estadoStockMayorista: true } },
        },
      }),
      prisma.margenMayorista.findMany(),
    ]);
    if (!cliente) return { ok: false, error: "El cliente no existe." };

    const margenesNum = margenes.map((m) => ({
      tipoProducto: m.tipoProducto,
      margenPorcentaje: Number(m.margenPorcentaje),
      margenPorcentajeTramo2: m.margenPorcentajeTramo2 != null ? Number(m.margenPorcentajeTramo2) : null,
      umbralKgTramo2: m.umbralKgTramo2 != null ? Number(m.umbralKgTramo2) : null,
    }));

    const items = [];
    for (const [productoId, cantidad] of cantidadPorProducto) {
      const producto = productos.find((p) => p.id === productoId);
      if (!producto) return { ok: false, error: "Hay un producto del carrito que ya no está en el catálogo. Quitalo y probá de nuevo." };
      // Límite por stock: Poco Stock hasta 2 unidades, Stock disponible hasta 6.
      const estado = estadoStockDe(producto.historialStock.map((h) => h.estadoStockMayorista));
      const maximo = maximoPorEstado(estado);
      if (maximo === 0) return { ok: false, error: `"${producto.nombre}" ya no tiene stock. Quitalo y probá de nuevo.` };
      if (cantidad > maximo) {
        return { ok: false, error: `"${producto.nombre}" tiene ${estado}: se pueden pedir hasta ${maximo} unidades.` };
      }
      const precio = precioMayoristaDe(
        {
          tipoProductoMayorista: producto.tipoProductoMayorista,
          contenido: Number(producto.contenido),
          unidadMedida: producto.unidadMedida,
          precioCostoUnitario: Number(producto.precioCostoUnitario),
        },
        margenesNum
      );
      if (precio == null) return { ok: false, error: `"${producto.nombre}" no tiene precio mayorista. Quitalo y probá de nuevo.` };
      items.push({ productoId, cantidad, precioVentaUnitario: Math.round(precio * 100) / 100, descuentoPorcentaje: 0 });
    }

    const ventaId = await registrarVenta({
      clienteId,
      // La venta necesita un canal: los pedidos del catálogo mayorista quedan como WhatsApp.
      canalVenta: "WHATSAPP",
      medioPago,
      esMayorista: true,
      comoNosConociste,
      descripcion: `Pedido mayorista (Catálogo mayorista) · Cómo nos conoció: ${comoNosConociste}`,
      usuarioId: Number(session.user.id),
      items,
      tituloTarjeta: "Venta mayorista a",
    });

    revalidatePath("/ventas");
    revalidatePath("/inventario");
    revalidatePath("/");
    revalidatePath("/tablero-control");

    const total = items.reduce((acc, i) => acc + i.cantidad * i.precioVentaUnitario, 0);
    return { ok: true, ventaId, total };
  } catch (error) {
    console.error("confirmarCarritoMayorista", error);
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo confirmar el carrito." };
  }
}
