import { NextRequest, NextResponse } from "next/server";
import { verificarFirmaTiendanube } from "@/lib/tiendanube-webhook";
import { prisma } from "@/lib/prisma";
import { eliminarVentaCore } from "@/lib/ventas";
import { sendTelegramMessage } from "@/lib/telegram";

const USUARIO_SISTEMA_EMAIL = "sistema-tiendanube@estacionmascotera.com.ar";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-linkedstore-hmac-sha256");

  if (!verificarFirmaTiendanube(rawBody, hmac)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const { id } = JSON.parse(rawBody) as { id: number; store_id: number };

  const venta = await prisma.venta.findUnique({ where: { tiendanubeOrderId: id }, include: { cliente: true } });
  if (!venta) {
    return NextResponse.json({ ok: true, sinVenta: true });
  }

  const usuarioSistema = await prisma.usuario.findFirstOrThrow({ where: { email: USUARIO_SISTEMA_EMAIL } });

  try {
    await eliminarVentaCore(venta.id, usuarioSistema.id);
  } catch (error) {
    console.error(`order-cancelled: error eliminando venta ${venta.id} (pedido Tiendanube ${id})`, error);
    await sendTelegramMessage(
      `🚨 Pedido Tiendanube #${id} se canceló pero no se pudo anular automáticamente la Venta #${venta.id} (${venta.cliente.nombre} ${venta.cliente.apellido}): ${error instanceof Error ? error.message : String(error)}. Revisar manualmente.`
    );
    return NextResponse.json({ error: "No se pudo anular la venta" }, { status: 500 });
  }

  await sendTelegramMessage(
    `❌ Pedido Tiendanube #${id} cancelado. Se anuló la Venta #${venta.id} (${venta.cliente.nombre} ${venta.cliente.apellido}) y se repuso el stock.`
  );

  return NextResponse.json({ ok: true, ventaEliminada: venta.id });
}
