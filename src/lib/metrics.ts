import { prisma } from "@/lib/prisma";
import { CategoriaGasto } from "@prisma/client";

interface RangoFechas {
  desde?: Date;
  hasta?: Date;
}

function fechaWhere({ desde, hasta }: RangoFechas) {
  if (!desde && !hasta) return undefined;
  return {
    ...(desde ? { gte: desde } : {}),
    ...(hasta ? { lt: hasta } : {}),
  };
}

export async function getDashboardMetrics(rango: RangoFechas) {
  const fechaVenta = fechaWhere(rango);
  const fechaCompra = fechaWhere(rango);
  const fechaGasto = fechaWhere(rango);

  const [detalles, ventasEnvio, compras, gastos, productos, ventasNoFact, comprasNoFact] =
    await Promise.all([
      prisma.detalleVenta.findMany({
        where: fechaVenta ? { venta: { fechaVenta } } : undefined,
        select: {
          cantidad: true,
          precioVentaUnitario: true,
          producto: { select: { precioCostoUnitario: true } },
        },
      }),
      prisma.venta.aggregate({
        where: fechaVenta ? { fechaVenta } : undefined,
        _sum: { costoEnvio: true },
      }),
      prisma.compra.aggregate({
        where: fechaCompra ? { fechaCompra } : undefined,
        _sum: { precioCostoUnitario: true, costoEnvio: true, cantidad: true },
      }),
      prisma.gasto.groupBy({
        by: ["categoriaGasto"],
        where: fechaGasto ? { fechaGasto } : undefined,
        _sum: { monto: true },
      }),
      prisma.producto.findMany({
        select: { stockActual: true, precioCostoUnitario: true },
      }),
      prisma.venta.findMany({
        where: { ...(fechaVenta ? { fechaVenta } : {}), facturado: false },
        select: {
          costoEnvio: true,
          detalles: { select: { cantidad: true, precioVentaUnitario: true } },
        },
      }),
      prisma.compra.findMany({
        where: { ...(fechaCompra ? { fechaCompra } : {}), facturado: false },
        select: { cantidad: true, precioCostoUnitario: true, costoEnvio: true },
      }),
    ]);

  let totalFacturado = 0;
  let costoMercaderiaVendida = 0;

  for (const d of detalles) {
    totalFacturado += d.cantidad * Number(d.precioVentaUnitario);
    costoMercaderiaVendida += d.cantidad * Number(d.producto.precioCostoUnitario);
  }

  const costosEnvioVentas = Number(ventasEnvio._sum.costoEnvio ?? 0);

  const totalComprasMercaderia =
    Number(compras._sum.precioCostoUnitario ?? 0) +
    Number(compras._sum.costoEnvio ?? 0);

  const gastosPorCategoria = gastos.map((g) => ({
    categoria: g.categoriaGasto,
    monto: Number(g._sum.monto ?? 0),
  }));

  const totalGastosFijos = gastosPorCategoria.reduce((acc, g) => acc + g.monto, 0);

  const totalGastado = totalComprasMercaderia + totalGastosFijos;

  const rentabilidadNeta =
    totalFacturado - costoMercaderiaVendida - costosEnvioVentas - totalGastosFijos;

  const valorStock = productos.reduce(
    (acc, p) => acc + p.stockActual * Number(p.precioCostoUnitario),
    0
  );

  const ventasNoFacturadas = {
    cantidad: ventasNoFact.length,
    total: ventasNoFact.reduce(
      (acc, v) =>
        acc +
        v.detalles.reduce((sub, d) => sub + d.cantidad * Number(d.precioVentaUnitario), 0) +
        Number(v.costoEnvio),
      0
    ),
  };

  const comprasNoFacturadas = {
    cantidad: comprasNoFact.length,
    total: comprasNoFact.reduce(
      (acc, c) => acc + c.cantidad * Number(c.precioCostoUnitario) + Number(c.costoEnvio ?? 0),
      0
    ),
  };

  return {
    totalFacturado,
    totalGastado,
    rentabilidadNeta,
    valorStock,
    gastosPorCategoria,
    ventasNoFacturadas,
    comprasNoFacturadas,
  };
}

export const CATEGORIA_GASTO_LABELS: Record<CategoriaGasto, string> = {
  MONOTRIBUTO: "Monotributo",
  TELEFONO: "Teléfono",
  COMMUNITY_MANAGER: "Community Manager",
  PUBLICIDAD: "Publicidad",
  SOPORTE_IT: "Soporte IT",
  OTROS: "Otros",
};
