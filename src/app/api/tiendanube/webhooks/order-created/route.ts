import { NextRequest, NextResponse } from "next/server";
import { verificarFirmaTiendanube } from "@/lib/tiendanube-webhook";
import { prisma } from "@/lib/prisma";
import { crearVentaCore } from "@/lib/ventas";
import { buscarOCrearCliente } from "@/lib/clientes";
import { sendTelegramMessage } from "@/lib/telegram";

const USUARIO_SISTEMA_EMAIL = "sistema-tiendanube@estacionmascotera.com.ar";
const COLUMNA_INGRESO_ORDEN = "Ingreso de Orden - Pendiente";

type PedidoTiendanube = {
  id: number;
  number: number;
  status: string;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    identification: string | null;
  };
  shipping_address: { address?: string | null } | null;
  shipping_cost_customer: string;
  products: {
    sku: string | null;
    name: string;
    quantity: string;
    price: string;
  }[];
};

async function traerPedidoTiendanube(storeId: string, accessToken: string, orderId: number): Promise<PedidoTiendanube> {
  const res = await fetch(`https://api.tiendanube.com/v1/${storeId}/orders/${orderId}`, {
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": "Sistema-EM-Sync (danielbere@gmail.com)",
    },
  });

  if (!res.ok) {
    throw new Error(`Error consultando pedido ${orderId} en Tiendanube: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as PedidoTiendanube;
}

function partirNombre(nombreCompleto: string) {
  const partes = nombreCompleto.trim().split(/\s+/);
  const nombre = partes[0] || "Cliente";
  const apellido = partes.slice(1).join(" ");
  return { nombre, apellido };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-linkedstore-hmac-sha256");

  if (!verificarFirmaTiendanube(rawBody, hmac)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const { id, store_id } = JSON.parse(rawBody) as { id: number; store_id: number };

  const ventaExistente = await prisma.venta.findUnique({ where: { tiendanubeOrderId: id } });
  if (ventaExistente) {
    return NextResponse.json({ ok: true, duplicado: true });
  }

  const config = await prisma.tiendanubeConfig.findUnique({ where: { storeId: String(store_id) } });
  if (!config) {
    return NextResponse.json({ error: "Tienda no configurada" }, { status: 404 });
  }

  let pedido: PedidoTiendanube;
  try {
    pedido = await traerPedidoTiendanube(config.storeId, config.accessToken, id);
  } catch (error) {
    console.error("order-created: error obteniendo pedido de Tiendanube", error);
    return NextResponse.json({ error: "No se pudo obtener el pedido" }, { status: 502 });
  }

  if (pedido.status === "cancelled") {
    console.error(`order-created: pedido ${pedido.number} ya está cancelado, no se crea venta`);
    return NextResponse.json({ ok: true, error: "Pedido cancelado" });
  }

  const productos = await prisma.producto.findMany({
    where: { skuInterno: { in: pedido.products.map((p) => p.sku).filter((sku): sku is string => !!sku) } },
    select: { id: true, skuInterno: true },
  });
  const productoPorSku = new Map(productos.map((p) => [p.skuInterno, p.id]));

  const skusNoResueltos: string[] = [];
  const items = pedido.products
    .map((p) => {
      if (!p.sku || !productoPorSku.has(p.sku)) {
        if (p.sku) skusNoResueltos.push(p.sku);
        return null;
      }
      return {
        productoId: productoPorSku.get(p.sku)!,
        cantidad: Number(p.quantity),
        precioVentaUnitario: Number(p.price),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (items.length === 0) {
    console.error(`order-created: ningún SKU resuelto para el pedido ${pedido.number}`, skusNoResueltos);
    await sendTelegramMessage(
      `⚠️ Pedido Tiendanube #${pedido.number} sin productos con SKU vinculado. SKUs: ${skusNoResueltos.join(", ") || "(sin SKU)"}`
    );
    return NextResponse.json({ ok: true, error: "Sin productos con SKU vinculado" });
  }

  const usuarioSistema = await prisma.usuario.findFirstOrThrow({ where: { email: USUARIO_SISTEMA_EMAIL } });

  const { nombre, apellido } = partirNombre(pedido.customer.name);
  const costoEnvio = Number(pedido.shipping_cost_customer) || 0;

  let ventaId: number;
  let clienteId: number;
  let productosStockNegativo: { nombre: string; stockActual: number }[];
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const cliente = await buscarOCrearCliente(tx, {
        nombre,
        apellido,
        direccion: pedido.shipping_address?.address ?? undefined,
        telefono: pedido.customer.phone,
        email: pedido.customer.email,
        dni: pedido.customer.identification,
      });

      const venta = await crearVentaCore(
        {
          clienteId: cliente.clienteId,
          canalVenta: "TIENDANUBE",
          medioPago: "Tiendanube",
          costoEnvio,
          facturado: false,
          usuarioId: usuarioSistema.id,
          tiendanubeOrderId: pedido.id,
          items,
        },
        tx
      );

      return { ventaId: venta.ventaId, clienteId: cliente.clienteId, productosStockNegativo: venta.productosStockNegativo };
    });
    ventaId = resultado.ventaId;
    clienteId = resultado.clienteId;
    productosStockNegativo = resultado.productosStockNegativo;
  } catch (error) {
    console.error(`order-created: error creando venta para pedido ${pedido.number}`, error);
    await sendTelegramMessage(
      `🚨 Error creando venta automática para pedido Tiendanube #${pedido.number}: ${error instanceof Error ? error.message : String(error)}`
    );
    return NextResponse.json({ error: "No se pudo crear la venta" }, { status: 500 });
  }

  try {
    const columna = await prisma.columnaTablero.findFirst({ where: { nombre: COLUMNA_INGRESO_ORDEN } });
    if (columna) {
      const ultima = await prisma.tarjetaTablero.findFirst({
        where: { columnaId: columna.id },
        orderBy: { orden: "desc" },
        select: { orden: true },
      });
      await prisma.tarjetaTablero.create({
        data: {
          titulo: `Orden #${pedido.number} ${nombre} ${apellido}`.trim(),
          columnaId: columna.id,
          ventaId,
          clienteId,
          orden: (ultima?.orden ?? 0) + 1,
        },
      });
    } else {
      console.error(`order-created: no se encontró la columna "${COLUMNA_INGRESO_ORDEN}"`);
    }
  } catch (error) {
    console.error("order-created: error creando tarjeta de tablero", error);
  }

  const avisoSkus = skusNoResueltos.length > 0 ? `\n⚠️ SKUs no vinculados: ${skusNoResueltos.join(", ")}` : "";
  const avisoStock =
    productosStockNegativo.length > 0
      ? `\n📉 Stock negativo, falta cargar compra: ${productosStockNegativo.map((p) => `${p.nombre} (${p.stockActual})`).join(", ")}`
      : "";
  await sendTelegramMessage(
    `🛒 Nuevo pedido Tiendanube #${pedido.number}\nCliente: ${nombre} ${apellido}\nItems: ${items.length}${avisoSkus}${avisoStock}`
  );

  return NextResponse.json({ ok: true, ventaId });
}
