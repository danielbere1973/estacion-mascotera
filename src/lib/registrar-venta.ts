import { prisma } from "@/lib/prisma";
import { crearVentaCore, calcularTotalACobrar, agregarPagoVentaCore, type CrearVentaInput } from "@/lib/ventas";
import {
  registrarPendientesCompra,
  moverOCrearTarjetaCompraMayorista,
  crearTarjetaIngresoOrden,
} from "@/lib/compras-mayoristas";
import { ejecutarCorteCompraHym } from "@/lib/corte-compras-hym";
import { sendTelegramMessage } from "@/lib/telegram";

// Circuito completo de una venta cargada en la app (Nueva venta y carrito del Catálogo mayorista):
// crea la venta, registra el pago si viene cobrada, los pendientes de compra a HYM y la tarjeta
// del Tablero, y avisa por Telegram. Devuelve el ID de la venta.
export async function registrarVenta(input: CrearVentaInput & { tituloTarjeta?: string }): Promise<number> {
  const { tituloTarjeta: prefijoTitulo = "Venta a", ...datosVenta } = input;

  const resultado = await prisma.$transaction(async (tx) => {
    const venta = await crearVentaCore(datosVenta, tx);

    if (datosVenta.cobrado) {
      const totalACobrar = calcularTotalACobrar(
        datosVenta.items.map((i) => ({ ...i, descuentoPorcentaje: i.descuentoPorcentaje ?? 0 })),
        datosVenta.costoEnvio ?? 0
      );
      await agregarPagoVentaCore(
        venta.ventaId,
        {
          monto: totalACobrar,
          medioPago: datosVenta.medioPago,
          fechaAcreditacion: datosVenta.fechaAcreditacion ?? null,
          cobradoPorId: datosVenta.cobradoPorId ?? null,
        },
        datosVenta.usuarioId,
        tx
      );
    }

    const { huboPendienteHym, sinMapeoHym, conMapeoHym } = await registrarPendientesCompra(tx, venta.productosStockNegativo);

    const cliente = await tx.cliente.findUniqueOrThrow({ where: { id: datosVenta.clienteId } });
    const titulo = `${prefijoTitulo} ${cliente.nombre} ${cliente.apellido}`;
    if (huboPendienteHym) {
      await moverOCrearTarjetaCompraMayorista(tx, { ventaId: venta.ventaId, clienteId: datosVenta.clienteId, titulo });
    } else {
      await crearTarjetaIngresoOrden(tx, { ventaId: venta.ventaId, clienteId: datosVenta.clienteId, titulo });
    }

    return { sinMapeoHym, conMapeoHym, huboPendienteHym, ventaId: venta.ventaId };
  });

  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: datosVenta.clienteId } });

  const productosVendidos = await prisma.producto.findMany({
    where: { id: { in: datosVenta.items.map((i) => i.productoId) } },
    select: { id: true, nombre: true },
  });
  const nombrePorProductoId = new Map(productosVendidos.map((p) => [p.id, p.nombre]));
  const detalleItems = datosVenta.items
    .map((i) => `${i.cantidad}x ${nombrePorProductoId.get(i.productoId) ?? "producto"}`)
    .join(", ");

  const avisoStockManual = resultado.huboPendienteHym
    ? `\n\n⚠️ ${resultado.conMapeoHym.join(", ")} se quedó sin stock — ya arrancó la compra automática a HYM, te aviso cuando esté confirmada.`
    : "";
  const tipo = datosVenta.esMayorista ? "Venta mayorista cargada" : "Venta cargada";
  await sendTelegramMessage(
    `🧾 ${tipo}: #${resultado.ventaId} — ${cliente.nombre} ${cliente.apellido}\n${detalleItems}${avisoStockManual}`
  );

  if (resultado.huboPendienteHym) {
    ejecutarCorteCompraHym().catch((error) =>
      console.error("registrarVenta: error disparando corte de compras HYM inmediato", error)
    );
  }

  if (resultado.sinMapeoHym.length > 0) {
    await sendTelegramMessage(
      `⚠️ ${resultado.sinMapeoHym.join(", ")} se quedó sin stock y no tiene proveedor mayorista cargado — hay que reponerlo a mano.`
    );
  }

  return resultado.ventaId;
}
