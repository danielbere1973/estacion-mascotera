import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { HYM_PROVEEDOR_ID } from "@/lib/compras-mayoristas";

const HORAS_TIMEOUT_EN_PROCESO = 2;

export type ResultadoCorteCompraHym =
  | { ok: true; items: 0 }
  | { ok: true; items: number; jobId: string }
  | { ok: false; error: string };

// Junta las líneas PENDIENTE de compra a HYM, las marca EN_PROCESO y le pasa
// el lote al servicio Python (que arma el carrito en el sitio de HYM, sin
// confirmar la compra). Se dispara inmediatamente después de cada venta que
// genera un pendiente nuevo; el cron diario de las 12:00 queda como respaldo
// por si el disparo inmediato falla (ngrok caído, timeout, etc.).
export async function ejecutarCorteCompraHym(): Promise<ResultadoCorteCompraHym> {
  const limiteTimeout = new Date(Date.now() - HORAS_TIMEOUT_EN_PROCESO * 60 * 60 * 1000);
  await prisma.pendienteCompraMayorista.updateMany({
    where: { estado: "EN_PROCESO", actualizadoAt: { lt: limiteTimeout } },
    data: { estado: "PENDIENTE", jobId: null },
  });

  const pendientes = await prisma.pendienteCompraMayorista.findMany({
    where: { estado: "PENDIENTE", proveedorId: HYM_PROVEEDOR_ID },
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
    select: { productoId: true, sku: true },
  });
  const codigoPorProducto = new Map(codigosHym.map((c) => [c.productoId, c.sku]));

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

  await sendTelegramMessage(`🛒 Corte de compras HYM iniciado: ${items.length} línea(s).`);

  return { ok: true, items: items.length, jobId };
}
