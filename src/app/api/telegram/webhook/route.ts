import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verificarSecretoTelegram,
  esChatAutorizado,
  sendTelegramMessage,
  editTelegramMessage,
  answerCallbackQuery,
} from "@/lib/telegram";
import { moverTarjetasComprMayoristaADespacho } from "@/lib/tablero";
import { armarPreviewCorteHym, ejecutarCorteCompraHym, type ItemPreviewCorteHym } from "@/lib/corte-compras-hym";
import { resolverPendienteSinStock } from "@/lib/compras-mayoristas";
import { armarNivelRaiz, armarNivelCategoria } from "@/lib/categorias-telegram";

type TelegramUpdate = {
  message?: { chat: { id: number }; text?: string };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
};

const LIMITE_RESULTADOS_BUSQUEDA = 10;

async function manejarMensaje(chatId: string, texto: string) {
  console.log("telegram/webhook: manejarMensaje inicio", { chatId, texto });
  const textoLimpio = texto.trim();
  if (!textoLimpio || textoLimpio.startsWith("/")) {
    await sendTelegramMessage(
      "Hola! Escribí parte del nombre, marca o SKU de un producto para consultar precio y stock, o navegá por categorías.",
      { chatId, botones: [[{ text: "🗂 Ver categorías", callback_data: "cat_root" }]] }
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
    select: { nombre: true, nombreTiendanube: true, marca: true, skuInterno: true, stockActual: true, precioVenta: true },
  });

  const botonesRespuesta = [
    [{ text: "🛒 Forzar corte HYM ahora", callback_data: "corte_hym:forzar" }],
    [{ text: "🗂 Ver categorías", callback_data: "cat_root" }],
  ];

  if (productos.length === 0) {
    await sendTelegramMessage(`No encontré productos para "${textoLimpio}".`, { chatId, botones: botonesRespuesta });
    return;
  }

  const lineas = productos.map(
    (p) =>
      `<b>${p.nombreTiendanube ?? p.nombre}</b> (${p.marca}) — SKU ${p.skuInterno}\nStock: ${p.stockActual} — $${Number(p.precioVenta).toFixed(2)}`
  );
  await sendTelegramMessage(lineas.join("\n\n"), { chatId, botones: botonesRespuesta });
}

function textoPreviewCorteHym(conMapeo: ItemPreviewCorteHym[], sinMapeo: ItemPreviewCorteHym[]): string {
  if (conMapeo.length === 0 && sinMapeo.length === 0) {
    return "No había pendientes de HYM.";
  }

  const partes: string[] = [];

  if (conMapeo.length > 0) {
    const lineas = conMapeo.map((i) => `• ${i.nombre} (SKU ${i.skuInterno}) x${i.cantidad}`);
    partes.push(`<b>Se pedirían a HYM:</b>\n${lineas.join("\n")}`);
  } else {
    partes.push("No hay items con mapeo HYM pendientes.");
  }

  if (sinMapeo.length > 0) {
    const lineas = sinMapeo.map((i) => `• ${i.nombre} (SKU ${i.skuInterno}) x${i.cantidad}`);
    partes.push(`<b>⚠️ Sin mapeo HYM (gestionar en otro lado):</b>\n${lineas.join("\n")}`);
  }

  return partes.join("\n\n");
}

function botonesPreviewCorteHym(conMapeo: ItemPreviewCorteHym[], excluidos: number[] = []) {
  const botones = conMapeo.map((i) => [
    {
      text: `❌ Sacar: ${i.nombre}`,
      callback_data: `corte_hym_sacar:${[...excluidos, i.lineaId].join(",")}`,
    },
  ]);
  if (conMapeo.length > 0) {
    botones.push([
      { text: "✅ Confirmar pedido", callback_data: `corte_hym_confirmar:${excluidos.join(",")}` },
    ]);
  }
  return botones;
}

async function manejarCallback(
  chatId: string,
  callbackData: string,
  messageId: number | undefined
): Promise<string> {
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
    const { conMapeo, sinMapeo } = await armarPreviewCorteHym();
    if (conMapeo.length === 0 && sinMapeo.length === 0) return "No había pendientes de HYM.";
    await sendTelegramMessage(textoPreviewCorteHym(conMapeo, sinMapeo), {
      chatId,
      botones: botonesPreviewCorteHym(conMapeo),
    });
    return "Vista previa enviada.";
  }

  if (accion === "corte_hym_sacar") {
    const excluidos = params[0]?.split(",").map(Number).filter((n) => !Number.isNaN(n)) ?? [];
    if (excluidos.length === 0 || !messageId) return "Callback inválido.";
    const { conMapeo, sinMapeo } = await armarPreviewCorteHym();
    const restante = conMapeo.filter((i) => !excluidos.includes(i.lineaId));
    await editTelegramMessage(
      chatId,
      messageId,
      textoPreviewCorteHym(restante, sinMapeo),
      botonesPreviewCorteHym(restante, excluidos)
    );
    return "Sacado de la vista previa.";
  }

  if (accion === "corte_hym_confirmar") {
    if (!messageId) return "Callback inválido.";
    const excluidos = params[0] ? params[0].split(",").map(Number).filter((n) => !Number.isNaN(n)) : [];
    const resultado = await ejecutarCorteCompraHym(excluidos);
    if (!resultado.ok) return `🚨 Error forzando corte HYM: ${resultado.error}`;
    const texto =
      resultado.items === 0
        ? "No había pendientes de HYM."
        : `🛒 Corte HYM confirmado: ${resultado.items} línea(s).`;
    await editTelegramMessage(chatId, messageId, texto);
    return "Confirmado.";
  }

  if (accion === "cat_root") {
    const { texto, botones } = await armarNivelRaiz();
    if (messageId) {
      await editTelegramMessage(chatId, messageId, texto, botones);
    } else {
      await sendTelegramMessage(texto, { chatId, botones });
    }
    return "Categorías.";
  }

  if (accion === "cat") {
    const [idParam, paginaParam] = (params[0] ?? "").split(",");
    const categoriaId = Number(idParam);
    const pagina = paginaParam ? Number(paginaParam) : 1;
    if (!categoriaId || Number.isNaN(categoriaId)) return "Callback inválido.";
    const nivel = await armarNivelCategoria(categoriaId, Number.isNaN(pagina) ? 1 : pagina);
    if (!nivel) return "Categoría no encontrada.";
    if (messageId) {
      await editTelegramMessage(chatId, messageId, nivel.texto, nivel.botones);
    } else {
      await sendTelegramMessage(nivel.texto, { chatId, botones: nivel.botones });
    }
    return "Navegando categoría.";
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
      console.error("telegram/webhook: secreto invalido", {
        recibidoLen: secretHeader?.length ?? 0,
        esperadoLen: (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").length,
      });
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const update = (await req.json()) as TelegramUpdate;
    console.log("telegram/webhook: update recibido", JSON.stringify(update));

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id.toString();
      console.log("telegram/webhook: callback_query", { chatId, data: cq.data, autorizado: chatId ? esChatAutorizado(chatId) : false });
      if (!chatId || !esChatAutorizado(chatId) || !cq.data) {
        await answerCallbackQuery(cq.id);
        return NextResponse.json({ ok: true });
      }

      const textoRespuesta = await manejarCallback(chatId, cq.data, cq.message?.message_id);
      await answerCallbackQuery(cq.id, textoRespuesta);
      return NextResponse.json({ ok: true });
    }

    if (update.message) {
      const chatId = update.message.chat.id.toString();
      const autorizado = esChatAutorizado(chatId);
      console.log("telegram/webhook: message", {
        chatId,
        text: update.message.text,
        autorizado,
        TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
        TELEGRAM_CHAT_ID_2: process.env.TELEGRAM_CHAT_ID_2,
      });
      if (autorizado && update.message.text) {
        await manejarMensaje(chatId, update.message.text);
        console.log("telegram/webhook: manejarMensaje completado");
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("telegram/webhook: error procesando update", error);
    return NextResponse.json({ ok: true, error: String(error) });
  }
}
