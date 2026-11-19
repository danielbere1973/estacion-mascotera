import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Pedidos mayoristas = ventas confirmadas desde el carrito del Catálogo mayorista (esMayorista).

export type ItemPedidoMayorista = {
  productoId: number;
  nombre: string;
  marca: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

export type PedidoMayorista = {
  id: number;
  fecha: string; // ISO
  clienteId: number;
  cliente: string;
  medioPago: string;
  comoNosConociste: string | null;
  estado: string | null; // columna del Tablero en la que está la tarjeta del pedido
  colorEstado: string | null;
  cobrado: boolean;
  total: number;
  items: ItemPedidoMayorista[];
};

export async function traerPedidosMayoristas(filtro: Prisma.VentaWhereInput = {}): Promise<PedidoMayorista[]> {
  const ventas = await prisma.venta.findMany({
    where: { ...filtro, esMayorista: true },
    orderBy: { id: "desc" },
    select: {
      id: true,
      fechaVenta: true,
      clienteId: true,
      medioPago: true,
      comoNosConociste: true,
      cobrado: true,
      costoEnvio: true,
      cliente: { select: { nombre: true, apellido: true } },
      detalles: {
        orderBy: { id: "asc" },
        select: {
          productoId: true,
          cantidad: true,
          precioVentaUnitario: true,
          descuentoPorcentaje: true,
          producto: { select: { nombre: true, nombreTiendanube: true, marca: true } },
        },
      },
      tarjetasTablero: {
        orderBy: { id: "asc" },
        take: 1,
        select: { columna: { select: { nombre: true, color: true } } },
      },
    },
  });

  return ventas.map((v) => {
    const items = v.detalles.map((d) => {
      const precioUnitario = Number(d.precioVentaUnitario);
      const subtotal = d.cantidad * precioUnitario * (1 - Number(d.descuentoPorcentaje) / 100);
      return {
        productoId: d.productoId,
        nombre: d.producto.nombreTiendanube ?? d.producto.nombre,
        marca: d.producto.marca,
        cantidad: d.cantidad,
        precioUnitario,
        subtotal,
      };
    });
    const columna = v.tarjetasTablero[0]?.columna ?? null;
    return {
      id: v.id,
      fecha: v.fechaVenta.toISOString(),
      clienteId: v.clienteId,
      cliente: `${v.cliente.apellido}, ${v.cliente.nombre}`,
      medioPago: v.medioPago,
      comoNosConociste: v.comoNosConociste,
      estado: columna?.nombre ?? null,
      colorEstado: columna?.color ?? null,
      cobrado: v.cobrado,
      total: items.reduce((acc, i) => acc + i.subtotal, 0) + Number(v.costoEnvio),
      items,
    };
  });
}
