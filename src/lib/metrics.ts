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

  const [detalles, ventasEnvio, costosCobranzaAgg, compras, gastos, productos, todasLasCompras, ventasNoFact, comprasNoFact, ventasConsig] =
    await Promise.all([
      prisma.detalleVenta.findMany({
        where: fechaVenta ? { venta: { fechaVenta } } : undefined,
        select: {
          cantidad: true,
          precioVentaUnitario: true,
          precioCostoUnitario: true,
          producto: { select: { precioCostoUnitario: true } },
        },
      }),
      prisma.venta.aggregate({
        where: fechaVenta ? { fechaVenta } : undefined,
        _sum: { costoEnvio: true },
      }),
      prisma.costoVenta.aggregate({
        where: fechaVenta ? { venta: { fechaVenta } } : undefined,
        _sum: { montoCalculado: true },
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
        select: { id: true, stockActual: true, precioCostoUnitario: true },
      }),
      // Todas las compras históricas para calcular costo promedio real por producto
      prisma.compra.findMany({
        select: { productoId: true, cantidad: true, precioCostoUnitario: true },
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
      prisma.ventaConsignacion.findMany({
        where: fechaVenta ? { fecha: fechaVenta } : undefined,
        select: {
          cantidad: true,
          precioVentaReal: true,
          detalleVentaId: true,
          detalle: { select: { precioCosto: true, consignacion: { select: { direccion: true } } } },
        },
      }),
    ]);

  let totalFacturado = 0;
  let costoMercaderiaVendida = 0;
  let gananciaConsignaciones = 0;

  for (const d of detalles) {
    totalFacturado += d.cantidad * Number(d.precioVentaUnitario);
    costoMercaderiaVendida += d.cantidad * Number(d.precioCostoUnitario ?? d.producto.precioCostoUnitario);
  }

  // Consignaciones: nuestra ganancia = 2/3 de (precioVenta - costo)
  for (const v of ventasConsig) {
    const costo = Number(v.detalle.precioCosto);
    const venta = Number(v.precioVentaReal);
    const ganancia = venta - costo;
    gananciaConsignaciones += (ganancia * 2 / 3) * v.cantidad;
    // Si RECIBIMOS y la venta no vino de "Nueva venta" (no tiene DetalleVenta vinculado),
    // sumamos al facturado acá porque si no, no está contada en ningún lado.
    // Las que sí vienen de "Nueva venta" ya se contaron arriba vía detalleVenta.
    if (v.detalle.consignacion.direccion === "RECIBIMOS" && !v.detalleVentaId) {
      totalFacturado += venta * v.cantidad;
    }
  }

  const costosEnvioVentas = Number(ventasEnvio._sum.costoEnvio ?? 0);
  const costosCobranzaVentas = Number(costosCobranzaAgg._sum.montoCalculado ?? 0);

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
    totalFacturado -
    costoMercaderiaVendida -
    costosEnvioVentas -
    costosCobranzaVentas -
    totalGastosFijos +
    gananciaConsignaciones;

  // Costo promedio ponderado por producto a partir de las compras reales.
  // Así el valor del stock no cambia cuando se actualiza la lista de precios.
  const costoPorProducto = new Map<number, { totalCosto: number; totalCantidad: number }>();
  for (const c of todasLasCompras) {
    const prev = costoPorProducto.get(c.productoId) ?? { totalCosto: 0, totalCantidad: 0 };
    costoPorProducto.set(c.productoId, {
      totalCosto: prev.totalCosto + Number(c.precioCostoUnitario) * c.cantidad,
      totalCantidad: prev.totalCantidad + c.cantidad,
    });
  }
  const valorStock = productos.reduce((acc, p) => {
    const data = costoPorProducto.get(p.id);
    const costoPromedio = data && data.totalCantidad > 0
      ? data.totalCosto / data.totalCantidad
      : Number(p.precioCostoUnitario);
    return acc + p.stockActual * costoPromedio;
  }, 0);

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
    costoMercaderiaVendida,
    costosCobranzaVentas,
    totalComprasMercaderia,
    gastosPorCategoria,
    ventasNoFacturadas,
    comprasNoFacturadas,
    gananciaConsignaciones,
    totalIngresosConsolidados: totalFacturado + gananciaConsignaciones,
  };
}

export async function getDashboardMetricsRestringido(rango: RangoFechas, proveedorId: number) {
  const fechaVenta = fechaWhere(rango);
  const fechaCompra = fechaWhere(rango);

  const comprasDelProveedor = await prisma.compra.findMany({
    where: { proveedorId },
    select: { productoId: true },
    distinct: ["productoId"],
  });
  const productoIds = comprasDelProveedor.map((c) => c.productoId);

  const [detalles, compras, productos, comprasHistoricas, ventasNoFact, comprasNoFact] = await Promise.all([
    prisma.detalleVenta.findMany({
      where: {
        productoId: { in: productoIds },
        ...(fechaVenta ? { venta: { fechaVenta } } : {}),
      },
      select: {
        cantidad: true,
        precioVentaUnitario: true,
        ventaId: true,
        producto: { select: { precioCostoUnitario: true } },
      },
    }),
    prisma.compra.aggregate({
      where: { proveedorId, ...(fechaCompra ? { fechaCompra } : {}) },
      _sum: { precioCostoUnitario: true, costoEnvio: true, cantidad: true },
    }),
    prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, stockActual: true, precioCostoUnitario: true },
    }),
    prisma.compra.findMany({
      where: { proveedorId },
      select: { productoId: true, cantidad: true, precioCostoUnitario: true },
    }),
    prisma.detalleVenta.findMany({
      where: {
        productoId: { in: productoIds },
        venta: { facturado: false, ...(fechaVenta ? { fechaVenta } : {}) },
      },
      select: { cantidad: true, precioVentaUnitario: true, ventaId: true },
    }),
    prisma.compra.findMany({
      where: { proveedorId, facturado: false, ...(fechaCompra ? { fechaCompra } : {}) },
      select: { cantidad: true, precioCostoUnitario: true, costoEnvio: true },
    }),
  ]);

  let totalFacturado = 0;
  let costoMercaderiaVendida = 0;

  for (const d of detalles) {
    totalFacturado += d.cantidad * Number(d.precioVentaUnitario);
    costoMercaderiaVendida += d.cantidad * Number(d.producto.precioCostoUnitario);
  }

  const totalComprasMercaderia =
    Number(compras._sum.precioCostoUnitario ?? 0) + Number(compras._sum.costoEnvio ?? 0);

  const totalGastado = totalComprasMercaderia;

  const rentabilidadNeta = totalFacturado - costoMercaderiaVendida;

  const costoPorProductoR = new Map<number, { totalCosto: number; totalCantidad: number }>();
  for (const c of comprasHistoricas) {
    const prev = costoPorProductoR.get(c.productoId) ?? { totalCosto: 0, totalCantidad: 0 };
    costoPorProductoR.set(c.productoId, {
      totalCosto: prev.totalCosto + Number(c.precioCostoUnitario) * c.cantidad,
      totalCantidad: prev.totalCantidad + c.cantidad,
    });
  }
  const valorStock = productos.reduce((acc, p) => {
    const data = costoPorProductoR.get(p.id);
    const costoPromedio = data && data.totalCantidad > 0
      ? data.totalCosto / data.totalCantidad
      : Number(p.precioCostoUnitario);
    return acc + p.stockActual * costoPromedio;
  }, 0);

  const ventasNoFacturadas = {
    cantidad: new Set(ventasNoFact.map((d) => d.ventaId)).size,
    total: ventasNoFact.reduce(
      (acc, d) => acc + d.cantidad * Number(d.precioVentaUnitario),
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
    costoMercaderiaVendida,
    totalComprasMercaderia,
    gastosPorCategoria: [] as { categoria: CategoriaGasto; monto: number }[],
    ventasNoFacturadas,
    comprasNoFacturadas,
    gananciaConsignaciones: 0,
    totalIngresosConsolidados: totalFacturado,
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
