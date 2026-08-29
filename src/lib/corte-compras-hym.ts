import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { HYM_PROVEEDOR_ID } from "@/lib/compras-mayoristas";

const HORAS_TIMEOUT_EN_PROCESO = 2;

export type ResultadoCorteCompraHym =
  | { ok: true; items: 0 }
  | { ok: true; items: number; jobId: string }
  | { ok: false; error: string };

export type ItemPreviewCorteHym = {
  lineaId: number;
  skuInterno: string;
  nombre: string;
  cantidad: number;
};

export type PreviewCorteHym = {
  conMapeo: ItemPreviewCorteHym[];
  sinMapeo: ItemPreviewCorteHym[];
};

async function reactivarPendientesTrabados() {
  const limiteTimeout = new Date(Date.now() - HORAS_TIMEOUT_EN_PROCESO * 60 * 60 * 1000);
  await prisma.pendienteCompraMayorista.updateMany({
    where: { estado: "EN_PROCESO", actualizadoAt: { lt: limiteTimeout } },
    data: { estado: "PENDIENTE", jobId: null },
  });
}

// Arma la vista previa de lo que se pediría a HYM: separa los pendientes que
// tienen mapeo HYM activo (se pedirían) de los que no (hay que gestionarlos
// en otro lado). No toca la base de datos ni dispara el job del scraper.
export async function armarPreviewCorteHym(): Promise<PreviewCorteHym> {
  await reactivarPendientesTrabados();

  const pendientes = await prisma.pendienteCompraMayorista.findMany({
    where: { estado: "PENDIENTE", proveedorId: HYM_PROVEEDOR_ID },
    include: { producto: { select: { nombre: true, skuInterno: true } } },
  });

  const codigosHym = await prisma.historialStockMayorista.findMany({
    where: {
      proveedorId: HYM_PROVEEDOR_ID,
      productoId: { in: pendientes.map((p) => p.productoId) },
      activo: true,
    },
    select: { productoId: true, sku: true, codigoHym: true },
  });
  const codigoPorProducto = new Map(
    codigosHym.map((c) => [c.productoId, c.codigoHym ?? c.sku.split("-")[0]])
  );

  const conMapeo: ItemPreviewCorteHym[] = [];
  const sinMapeo: ItemPreviewCorteHym[] = [];

  for (const p of pendientes) {
    const item = { lineaId: p.id, skuInterno: p.producto.skuInterno, nombre: p.producto.nombre, cantidad: p.cantidad };
    if (codigoPorProducto.has(p.productoId)) {
      conMapeo.push(item);
    } else {
      sinMapeo.push(item);
    }
  }

  return { conMapeo, sinMapeo };
}

// Junta las líneas PENDIENTE de compra a HYM, las marca EN_PROCESO y le pasa
// el lote al servicio Python (que arma el carrito en el sitio de HYM, sin
// confirmar la compra). Se dispara inmediatamente después de cada venta que
// genera un pendiente nuevo; el cron diario de las 12:00 queda como respaldo
// por si el disparo inmediato falla (ngrok caído, timeout, etc.). `excluirLineaIds`
// permite sacar líneas puntuales (ej. desde la vista previa de Telegram, cuando
// Daniel prefiere comprar ese producto en otro lado aunque HYM lo tenga).
export async function ejecutarCorteCompraHym(excluirLineaIds: number[] = []): Promise<ResultadoCorteCompraHym> {
  await reactivarPendientesTrabados();

  const pendientes = await prisma.pendienteCompraMayorista.findMany({
    where: {
      estado: "PENDIENTE",
      proveedorId: HYM_PROVEEDOR_ID,
      ...(excluirLineaIds.length > 0 ? { id: { notIn: excluirLineaIds } } : {}),
    },
    include: { producto: { select: { nombre: true, skuInterno: true } } },
  });

  if (pendientes.length === 0) {
    return { ok: true, items: 0 };
  }

  const codigosHym = await prisma.historialStockMayorista.findMany({
    where: {
      proveedorId: HYM_PROVEEDOR_ID,
      productoId: { in: pendientes.map((p) => p.productoId) },
      activo: true,
    },
    select: { productoId: true, sku: true, codigoHym: true },
  });
  const codigoPorProducto = new Map(
    codigosHym.map((c) => [c.productoId, c.codigoHym ?? c.sku.split("-")[0]])
  );

  const jobId = randomUUID();
  const items = pendientes
    .map((p) => ({
      lineaId: p.id,
      codigoHym: codigoPorProducto.get(p.productoId),
      skuInterno: p.producto.skuInterno,
      nombre: p.producto.nombre,
      cantidad: p.cantidad,
    }))
    .filter((item): item is typeof item & { codigoHym: string } => !!item.codigoHym);

  if (items.length === 0) {
    return { ok: true, items: 0 };
  }

  const scraperUrl = process.env.HYM_SCRAPER_URL;
  const scraperSecret = process.env.HYM_SCRAPER_SECRET;
  const callbackToken = process.env.HYM_CALLBACK_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!scraperUrl || !scraperSecret || !callbackToken || !appUrl) {
    console.error("corte-compras-hym: faltan variables de entorno para llamar al servicio Python");
    await sendTelegramMessage("🚨 Corte de compras HYM: falta configuración del servicio (env vars).");
    return { ok: false, error: "Configuración incompleta" };
  }

  await prisma.pendienteCompraMayorista.updateMany({
    where: { id: { in: items.map((i) => i.lineaId) } },
    data: { estado: "EN_PROCESO", jobId },
  });

  try {
    const res = await fetch(`${scraperUrl}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": scraperSecret },
      body: JSON.stringify({
        jobId,
        callbackUrl: `${appUrl}/api/hym/resultado-job`,
        callbackToken,
        items,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Servicio HYM respondió ${res.status}: ${await res.text()}`);
    }
  } catch (error) {
    console.error("corte-compras-hym: no se pudo iniciar el job en el servicio Python", error);
    await prisma.pendienteCompraMayorista.updateMany({
      where: { jobId },
      data: { estado: "PENDIENTE", jobId: null },
    });
    await sendTelegramMessage(
      `🚨 Corte de compras HYM no se pudo iniciar: ${error instanceof Error ? error.message : String(error)}`
    );
    return { ok: false, error: "No se pudo iniciar el job" };
  }

  await sendTelegramMessage(`🛒 Corte de compras HYM iniciado: ${items.length} línea(s).`, {
    botones: [[{ text: "✅ Ya compré", callback_data: `mover_tarjetas_hym:${jobId}` }]],
  });

  return { ok: true, items: items.length, jobId };
}
