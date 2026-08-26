import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verificarSecretoTelegram,
  esChatAutorizado,
  sendTelegramMessage,
  answerCallbackQuery,
} from "@/lib/telegram";
import { moverTarjetasComprMayoristaADespacho } from "@/lib/tablero";
import { ejecutarCorteCompraHym } from "@/lib/corte-compras-hym";
import { resolverPendienteSinStock } from "@/lib/compras-mayoristas";

type TelegramUpdate = {
  message?: { chat: { id: number }; text?: string };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number } };
  };
};

const LIMITE_RESULTADOS_BUSQUEDA = 10;

async function manejarMensaje(chatId: string, texto: string) {
  const textoLimpio = texto.trim();
  if (!textoLimpio || textoLimpio.startsWith("/")) {
    await sendTelegramMessage(
      "Hola! Escribí parte del nombre, marca o SKU de un producto para consultar precio y stock.",
      { chatId }
    );
    return;
  }

  const productos = await prisma.producto.findMany({
    where: {
      activo: true,
      OR: [
        { nombre: { contains: textoLimpio, mode: "insensitive" } },
        { marca: { contains: textoLimpio, mode: "insensitive" } },
        { skuInterno: { contains: textoLimpio, mode: "insensitive" } },
      ],
    },
    take: LIMITE_RESULTADOS_BUSQUEDA,
    orderBy: [{ marca: "asc" }, { nombre: "asc" }],
    select: { nombre: true, marca: true, skuInterno: true, stockActual: true, precioVenta: true },
  });

  const botonCorteHym = [[{ text: "🛒 Forzar corte HYM ahora", callback_data: "corte_hym:forzar" }]];

  if (productos.length === 0) {
    await sendTelegramMessage(`No encontré productos para "${textoLimpio}".`, { chatId, botones: botonCorteHym });
    return;
  }

  const lineas = productos.map(
    (p) =>
      `<b>${p.nombre}</b> (${p.marca}) — SKU ${p.skuInterno}\nStock: ${p.stockActual} — $${Number(p.precioVenta).toFixed(2)}`
  );
  await sendTelegramMessage(lineas.join("\n\n"), { chatId, botones: botonCorteHym });
}

async function manejarCallback(chatId: string, callbackData: string): Promise<string> {
  const [accion, ...params] = callbackData.split(":");

  if (accion === "mover_tarjetas_hym") {
    const jobId = params.join(":");
    if (!jobId) return "Callback inválido.";
    const cantidad = await moverTarjetasComprMayoristaADespacho(jobId);
    return cantidad > 0
      ? `✅ Se movieron ${cantidad} tarjeta(s) a "Lista para despacho".`
      : "No encontré tarjetas de esta compra en \"Comprar en Mayorista\".";
  }

  if (accion === "corte_hym" && params[0] === "forzar") {
    const resultado = await ejecutarCorteCompraHym();
    if (!resultado.ok) return `🚨 Error forzando corte HYM: ${resultado.error}`;
    return resultado.items === 0 ? "No había pendientes de HYM." : `🛒 Corte HYM iniciado: ${resultado.items} línea(s).`;
  }

  if (accion === "sin_stock") {
    const pendienteId = Number(params[0]);
    const hayStockReal = params[1] === "si";
    if (!pendienteId) return "Callback inválido.";
    await resolverPendienteSinStock(pendienteId, hayStockReal);
    return hayStockReal
      ? "✅ Marcado con stock real, se reintenta en el próximo corte."
      : "❌ Marcado sin stock, no se reintenta.";
  }

  return "Acción no reconocida.";
}

export async function POST(req: NextRequest) {
  try {
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (!verificarSecretoTelegram(secretHeader)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const update = (await req.json()) as TelegramUpdate;

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id.toString();
      if (!chatId || !esChatAutorizado(chatId) || !cq.data) {
        await answerCallbackQuery(cq.id);
        return NextResponse.json({ ok: true });
      }

      const textoRespuesta = await manejarCallback(chatId, cq.data);
      await answerCallbackQuery(cq.id, textoRespuesta);
      return NextResponse.json({ ok: true });
    }

    if (update.message) {
      const chatId = update.message.chat.id.toString();
      if (esChatAutorizado(chatId) && update.message.text) {
        await manejarMensaje(chatId, update.message.text);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("telegram/webhook: error procesando update", error);
    return NextResponse.json({ ok: true });
  }
}
