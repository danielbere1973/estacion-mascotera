import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarTokenCallbackHym } from "@/lib/hym-callback";
import { crearCompraCore } from "@/lib/compras";
import { sendTelegramMessage, type BotonInline } from "@/lib/telegram";
import { HYM_PROVEEDOR_ID } from "@/lib/compras-mayoristas";

const USUARIO_SISTEMA_EMAIL = "sistema-hym@estacionmascotera.com.ar";
const UMBRAL_FALLOS_ALERTA = 3;

type ResultadoLinea = {
  lineaId: number;
  ok: boolean;
  precioUnitarioScrapeado?: number;
  motivo?: string;
};

type BodyCallback = {
  jobId: string;
  resultados: ResultadoLinea[];
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-hym-callback-token");
  if (!verificarTokenCallbackHym(token)) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const body = (await req.json()) as BodyCallback;
  const usuarioSistema = await prisma.usuario.findFirstOrThrow({ where: { email: USUARIO_SISTEMA_EMAIL } });

  let ok = 0;
  const sinStock: { pendienteId: number; nombre: string }[] = [];
  const otrosFallos: { nombre: string; motivo: string }[] = [];
  const requierenRevision: string[] = [];

  for (const resultado of body.resultados) {
    const pendiente = await prisma.pendienteCompraMayorista.findUnique({
      where: { id: resultado.lineaId },
      include: { producto: true },
    });
    if (!pendiente) {
      console.error(`resultado-job: línea ${resultado.lineaId} no encontrada (job ${body.jobId})`);
      continue;
    }

    if (resultado.ok) {
      let precioCostoUnitario = resultado.precioUnitarioScrapeado;
      if (precioCostoUnitario === undefined) {
        const mapeo = await prisma.historialStockMayorista.findFirst({
          where: { productoId: pendiente.productoId, proveedorId: HYM_PROVEEDOR_ID, activo: true },
          select: { precioCostoScraped: true },
        });
        precioCostoUnitario = mapeo ? Number(mapeo.precioCostoScraped) : 0;
      }

      try {
        await prisma.$transaction(async (tx) => {
          const compra = await crearCompraCore(
            {
              proveedorId: HYM_PROVEEDOR_ID,
              productoId: pendiente.productoId,
              cantidad: pendiente.cantidad,
              precioCostoUnitario: precioCostoUnitario!,
              usuarioId: usuarioSistema.id,
              numeroPedido: body.jobId,
            },
            tx
          );
          await tx.pendienteCompraMayorista.update({
            where: { id: pendiente.id },
            data: { estado: "RESUELTO", compraId: compra.compraId, errorMotivo: null },
          });
        });
        ok++;
      } catch (error) {
        console.error(`resultado-job: error creando compra para línea ${pendiente.id}`, error);
        otrosFallos.push({
          nombre: pendiente.producto.nombre,
          motivo: error instanceof Error ? error.message : String(error),
        });
        await prisma.pendienteCompraMayorista.update({
          where: { id: pendiente.id },
          data: { estado: "PENDIENTE", jobId: null, errorMotivo: "Error creando Compra, ver logs" },
        });
      }
      continue;
    }

    const motivo = resultado.motivo ?? "sin especificar";
    await prisma.pendienteCompraMayorista.update({
      where: { id: pendiente.id },
      data: { estado: "PENDIENTE", jobId: null, errorMotivo: motivo },
    });

    if (motivo === "sin_stock_hym") {
      sinStock.push({ pendienteId: pendiente.id, nombre: pendiente.producto.nombre });
    } else {
      otrosFallos.push({ nombre: pendiente.producto.nombre, motivo });
    }

    const fallosPrevios = await prisma.pendienteCompraMayorista.count({
      where: { productoId: pendiente.productoId, proveedorId: HYM_PROVEEDOR_ID, estado: { in: ["PENDIENTE", "FALLIDO"] } },
    });
    if (fallosPrevios >= UMBRAL_FALLOS_ALERTA) {
      requierenRevision.push(pendiente.producto.nombre);
    }
  }

  const partes = [`🧾 Compra HYM (job ${body.jobId}): ${ok} OK`];
  if (sinStock.length > 0) {
    partes.push(
      `\n⚠️ HYM marca sin stock (confirmar por WhatsApp, no asumir stock 0): ${sinStock.map((s) => s.nombre).join(", ")}`
    );
  }
  if (otrosFallos.length > 0) {
    partes.push(`\n❌ Fallidos: ${otrosFallos.map((f) => `${f.nombre} (${f.motivo})`).join(", ")}`);
  }
  if (requierenRevision.length > 0) {
    partes.push(`\n🚨 Requieren revisión manual (fallan repetidamente): ${requierenRevision.join(", ")}`);
  }

  const botonesSinStock: BotonInline[][] = sinStock.map((s) => [
    { text: `✅ Hay stock: ${s.nombre}`, callback_data: `sin_stock:${s.pendienteId}:si` },
    { text: `❌ No hay: ${s.nombre}`, callback_data: `sin_stock:${s.pendienteId}:no` },
  ]);

  await sendTelegramMessage(partes.join(""), botonesSinStock.length > 0 ? { botones: botonesSinStock } : undefined);

  return NextResponse.json({ ok: true, procesadas: body.resultados.length, exitosas: ok });
}
