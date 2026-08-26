"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { calcularCambiosHym, aplicarCambioHym, type FilaCambioHym } from "@/lib/hym-precios";

export async function calcularPreviewHym(formData: FormData) {
  await requireAdmin();

  const csvFile = formData.get("csv") as File | null;
  const hymFile = formData.get("hymExcel") as File | null;
  if (!csvFile || csvFile.size === 0) throw new Error("Subí el archivo productos.csv");
  if (!hymFile || hymFile.size === 0) throw new Error("Subí el archivo Productos-Cambios_HyM.xlsx");

  const config = await prisma.tiendanubeConfig.findFirst();
  if (!config) throw new Error("No hay tienda de Tiendanube autorizada.");

  const csvBuffer = Buffer.from(await csvFile.arrayBuffer());
  const hymBuffer = Buffer.from(await hymFile.arrayBuffer());

  return calcularCambiosHym(config.storeId, config.accessToken, csvBuffer, hymBuffer);
}

const TAMANIO_LOTE_MAX = 20;

export async function aplicarLoteHym(filas: FilaCambioHym[]) {
  await requireAdmin();

  if (filas.length === 0) return { exitosos: [] as string[], errores: [] as { sku: string; status: number; detalle: string }[] };
  if (filas.length > TAMANIO_LOTE_MAX) {
    throw new Error(`El lote supera el máximo de ${TAMANIO_LOTE_MAX} filas.`);
  }

  const config = await prisma.tiendanubeConfig.findFirst();
  if (!config) throw new Error("No hay tienda de Tiendanube autorizada.");

  const exitosos: string[] = [];
  const errores: { sku: string; status: number; detalle: string }[] = [];

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const resultado = await aplicarCambioHym(config.storeId, config.accessToken, fila);
    if (resultado.ok) {
      exitosos.push(fila.skuHym);
    } else {
      errores.push({ sku: fila.skuHym, status: resultado.status, detalle: resultado.detalle });
    }

    if (i < filas.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 550));
    }
  }

  return { exitosos, errores };
}
