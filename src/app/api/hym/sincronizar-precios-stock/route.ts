import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarTokenSyncHym } from "@/lib/hym-callback";
import { calcularCambiosHym, aplicarCambioHym, generarExcelActualizadoHym } from "@/lib/hym-precios";
import { sendTelegramMessage } from "@/lib/telegram";

export const maxDuration = 300;

// Endpoint invocado por el servicio local (server.py, en la PC de Daniel) después
// de que el scraper HYM termina y valida que productos.csv quedó completo. A
// diferencia del flujo manual de la pantalla mayoristas-hym (donde Daniel revisa
// la tabla y confirma), acá se aplican TODOS los cambios calculados sin revisión
// humana previa — es una decisión explícita para la automatización.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-hym-sync-token");
  if (!verificarTokenSyncHym(token)) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const body = (await req.json()) as { csvBase64?: string; hymExcelBase64?: string };
  if (!body.csvBase64 || !body.hymExcelBase64) {
    return NextResponse.json({ error: "Faltan csvBase64 o hymExcelBase64" }, { status: 400 });
  }

  const config = await prisma.tiendanubeConfig.findFirst();
  if (!config) {
    return NextResponse.json({ error: "No hay tienda de Tiendanube autorizada." }, { status: 500 });
  }

  const csvBuffer = Buffer.from(body.csvBase64, "base64");
  const hymBuffer = Buffer.from(body.hymExcelBase64, "base64");

  let resultado;
  try {
    resultado = await calcularCambiosHym(config.storeId, config.accessToken, csvBuffer, hymBuffer);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    await sendTelegramMessage(`❌ Sync HYM automático: falló el cálculo de cambios.\n${detalle}`);
    return NextResponse.json({ error: detalle }, { status: 500 });
  }

  const aAplicar = resultado.cambios.filter((f) => !f.sinCambioReal);
  const exitosos: string[] = [];
  const errores: { sku: string; status: number; detalle: string }[] = [];

  for (let i = 0; i < aAplicar.length; i++) {
    const fila = aAplicar[i];
    const res = await aplicarCambioHym(config.storeId, config.accessToken, fila);
    if (res.ok) {
      exitosos.push(fila.skuHym);
    } else {
      errores.push({ sku: fila.skuHym, status: res.status, detalle: res.detalle });
    }
    if (i < aAplicar.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 550));
    }
  }

  let excelActualizadoBase64: string | null = null;
  try {
    const excelBuffer = await generarExcelActualizadoHym(config.storeId, config.accessToken, csvBuffer, hymBuffer);
    excelActualizadoBase64 = excelBuffer.toString("base64");
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    await sendTelegramMessage(`⚠️ Sync HYM automático: se aplicaron los cambios en Tiendanube pero falló la generación del Excel actualizado.\n${detalle}`);
  }

  const partes = [
    `🔄 Sync HYM automático: ${exitosos.length} cambios aplicados en Tiendanube` +
      (errores.length > 0 ? `, ${errores.length} errores` : "") +
      ".",
  ];
  if (resultado.resumen.sinSkuInterno > 0 || resultado.resumen.sinVarianteTN > 0) {
    partes.push(
      `\nSin resolver: ${resultado.resumen.sinSkuInterno} sin SKU interno, ${resultado.resumen.sinVarianteTN} sin variante en Tiendanube.`,
    );
  }
  if (errores.length > 0) {
    partes.push(`\n❌ Errores: ${errores.map((e) => `${e.sku} (${e.status})`).join(", ")}`);
  }
  if (!excelActualizadoBase64) {
    partes.push(`\n⚠️ No se pudo generar el Excel de mapeo actualizado, revisar manualmente.`);
  }
  await sendTelegramMessage(partes.join(""));

  await prisma.sincronizacionHym.create({
    data: {
      origen: "automatico",
      exitosos: exitosos.length,
      erroresCount: errores.length,
      totalFilasCsv: resultado.resumen.totalFilasCsv,
      resumenJson: resultado.resumen,
      cambiosJson: aAplicar,
      erroresJson: errores,
      sinResolverJson: resultado.sinResolver,
      excelActualizado: excelActualizadoBase64 !== null,
    },
  });

  return NextResponse.json({
    ok: true,
    exitosos: exitosos.length,
    errores,
    resumen: resultado.resumen,
    excelActualizadoBase64,
  });
}
