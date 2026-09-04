import { prisma } from "@/lib/prisma";

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
        where: fechaVenta
          ? { venta: { fechaVenta, esVentaInterna: false } }
          : { venta: { esVentaInterna: false } },
        select: {
          cantidad: true,
          precioVentaUnitario: true,
          descuentoPorcentaje: true,
          precioCostoUnitario: true,
          producto: { select: { precioCostoUnitario: true } },
          venta: { select: { vendidoPor: { select: { nombre: true } } } },
          ventaConsignacion: {
            select: { detalle: { select: { precioCosto: true } } },
          },
        },
      }),
      prisma.venta.aggregate({
        where: fechaVenta ? { fechaVenta, esVentaInterna: false } : { esVentaInterna: false },
        _sum: { costoEnvio: true },
      }),
      prisma.costoVenta.aggregate({
        where: fechaVenta
          ? { venta: { fechaVenta, esVentaInterna: false } }
          : { venta: { esVentaInterna: false } },
        _sum: { montoCalculado: true },
      }),
      prisma.compra.aggregate({
        where: fechaCompra ? { fechaCompra } : undefined,
        _sum: { precioCostoUnitario: true, costoEnvio: true, cantidad: true },
      }),
      prisma.gasto.findMany({
        where: fechaGasto ? { fechaGasto } : undefined,
        select: { categoriaGasto: true, esFijo: true, tipoGasto: true, monto: true },
      }),
      prisma.producto.findMany({
        select: { id: true, stockActual: true, precioCostoUnitario: true },
      }),
      // Todas las compras históricas para calcular costo promedio real por producto
      prisma.compra.findMany({
        select: { productoId: true, cantidad: true, precioCostoUnitario: true },
      }),
      prisma.venta.findMany({
        where: { ...(fechaVenta ? { fechaVenta } : {}), facturado: false, esVentaInterna: false },
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
  const ventasPorVendedor = new Map<string, number>([
    ["Daniel", 0],
    ["Pablo", 0],
    ["Estación Mascotera", 0],
  ]);

  for (const d of detalles) {
    const precioVenta = Number(d.precioVentaUnitario) * (1 - Number(d.descuentoPorcentaje ?? 0) / 100);
    const montoVenta = d.cantidad * precioVenta;
    totalFacturado += montoVenta;

    const nombreVendedor = d.venta.vendidoPor?.nombre ?? "";
    const clave = nombreVendedor.startsWith("Daniel")
      ? "Daniel"
      : nombreVendedor.startsWith("Pablo")
        ? "Pablo"
        : "Estación Mascotera";
    ventasPorVendedor.set(clave, (ventasPorVendedor.get(clave) ?? 0) + montoVenta);

    if (d.ventaConsignacion) {
      // Producto de consignación (RECIBIMOS): costo efectivo = precioCosto + 1/3*(precioVenta - precioCosto)
      const costo = Number(d.ventaConsignacion.detalle.precioCosto);
      const costoEfectivo = costo + (precioVenta - costo) / 3;
      costoMercaderiaVendida += d.cantidad * costoEfectivo;
    } else {
      costoMercaderiaVendida += d.cantidad * Number(d.precioCostoUnitario ?? d.producto.precioCostoUnitario);
    }
  }

  // Consignaciones registradas sin "Nueva venta" vinculada: solo contamos nuestra comisión 2/3
  for (const v of ventasConsig) {
    const costo = Number(v.detalle.precioCosto);
    const ventaReal = Number(v.precioVentaReal);
    const ganancia = ventaReal - costo;
    if (v.detalle.consignacion.direccion === "RECIBIMOS" && !v.detalleVentaId) {
      // Sin DetalleVenta → la venta no está en totalFacturado, sumamos solo nuestra comisión
      gananciaConsignaciones += (ganancia * 2 / 3) * v.cantidad;
      totalFacturado += (ganancia * 2 / 3) * v.cantidad;
    } else if (v.detalle.consignacion.direccion === "ENTREGAMOS") {
      // Ellos vendieron nuestros productos — nuestra parte es costo + 1/3 ganancia
      gananciaConsignaciones += (costo + ganancia / 3) * v.cantidad;
    }
    // Si tiene detalleVentaId (RECIBIMOS con Nueva venta): ya está en totalFacturado y costoMercaderiaVendida arriba
  }

  const costosEnvioVentas = Number(ventasEnvio._sum.costoEnvio ?? 0);
  const costosCobranzaVentas = Number(costosCobranzaAgg._sum.montoCalculado ?? 0);

  const totalComprasMercaderia =
    Number(compras._sum.precioCostoUnitario ?? 0) +
    Number(compras._sum.costoEnvio ?? 0);

  const gastosPorCategoria = gastos.map((g) => ({
    categoria: g.categoriaGasto,
    esFijo: g.esFijo,
    tipoGasto: g.tipoGasto,
    monto: Number(g.monto),
  }));

  const totalGastosFijosDelPeriodo = gastosPorCategoria.filter((g) => g.tipoGasto === "FIJO").reduce((acc, g) => acc + g.monto, 0);
  const totalGastosVariables = gastosPorCategoria.filter((g) => g.tipoGasto === "VARIABLE").reduce((acc, g) => acc + g.monto, 0);
  const totalGastosMarketing = gastosPorCategoria.filter((g) => g.tipoGasto === "MARKETING").reduce((acc, g) => acc + g.monto, 0);
  const totalGastosExcepcionales = gastosPorCategoria.filter((g) => g.tipoGasto === "EXCEPCIONAL").reduce((acc, g) => acc + g.monto, 0);
  const totalGastos = totalGastosFijosDelPeriodo + totalGastosVariables + totalGastosMarketing + totalGastosExcepcionales;

  const totalGastado = totalComprasMercaderia + totalGastos;

  // Rentabilidad operativa: venta - costo de mercadería - comisiones - envío - gastos variables
  // (los gastos variables incluyen costos directos de venta como envíos pagados por fuera de Venta.costoEnvio)
  const rentabilidadSinFijos =
    totalFacturado -
    costoMercaderiaVendida -
    costosEnvioVentas -
    costosCobranzaVentas -
    totalGastosVariables;

  // Rentabilidad neta: operativa - gastos fijos, marketing y excepcionales del período
  const rentabilidadNeta =
    rentabilidadSinFijos - totalGastosFijosDelPeriodo - totalGastosMarketing - totalGastosExcepcionales;

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
    rentabilidadSinFijos,
    totalGastosFijosDelPeriodo,
    totalGastosVariables,
    totalGastosMarketing,
    totalGastosExcepcionales,
    valorStock,
    costoMercaderiaVendida,
    costosCobranzaVentas,
    totalComprasMercaderia,
    gastosPorCategoria,
    ventasNoFacturadas,
    comprasNoFacturadas,
    gananciaConsignaciones,
    totalIngresosConsolidados: totalFacturado,
    ventasPorVendedor: {
      daniel: ventasPorVendedor.get("Daniel") ?? 0,
      pablo: ventasPorVendedor.get("Pablo") ?? 0,
      estacionMascotera: ventasPorVendedor.get("Estación Mascotera") ?? 0,
    },
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
    rentabilidadSinFijos: rentabilidadNeta,
    totalGastosFijosDelPeriodo: 0,
    totalGastosVariables: 0,
    totalGastosExcepcionales: 0,
    valorStock,
    costoMercaderiaVendida,
    costosCobranzaVentas: 0,
    totalComprasMercaderia,
    gastosPorCategoria: [] as { categoria: string; esFijo: boolean; monto: number }[],
    ventasNoFacturadas,
    comprasNoFacturadas,
    gananciaConsignaciones: 0,
    totalIngresosConsolidados: totalFacturado,
    ventasPorVendedor: { daniel: 0, pablo: 0, estacionMascotera: 0 },
  };
}

export const CATEGORIAS_GASTO_SUGERIDAS = [
  "Fijo",
  "Variable",
  "Soporte",
  "Excepcional",
  "Publicidad",
  "Monotributo",
  "Teléfono",
  "Community Manager",
  "Soporte IT",
  "Logística",
  "Otros",
];
