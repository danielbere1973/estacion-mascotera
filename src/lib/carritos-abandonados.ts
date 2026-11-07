import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

type CheckoutTiendanube = {
  id: number;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  total: string;
  abandoned_checkout_url: string | null;
  completed_at: string | null;
  products: { name: string; quantity: number; sku: string | null }[];
};

async function traerCheckoutsAbandonados(storeId: string, accessToken: string): Promise<CheckoutTiendanube[]> {
  const res = await fetch(`https://api.tiendanube.com/2025-03/${storeId}/checkouts?per_page=50`, {
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": "Sistema-EM-Sync (danielbere@gmail.com)",
    },
  });

  if (!res.ok) {
    throw new Error(`Error consultando checkouts en Tiendanube: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as CheckoutTiendanube[];
}

// Marca como "ya vistos" todos los carritos abandonados actuales sin avisar por Telegram.
// Se corre una sola vez, antes de activar el cron, para no notificar retroactivamente
// los carritos que ya estaban abandonados de antes.
export async function sembrarCarritosAbandonadosExistentes() {
  const config = await prisma.tiendanubeConfig.findFirst();
  if (!config) {
    return { ok: false as const, error: "Tienda no configurada" };
  }

  const checkouts = await traerCheckoutsAbandonados(config.storeId, config.accessToken);
  const abandonados = checkouts.filter((c) => !c.completed_at);

  await prisma.carritoAbandonadoNotificado.createMany({
    data: abandonados.map((c) => ({ checkoutId: BigInt(c.id) })),
    skipDuplicates: true,
  });

  return { ok: true as const, sembrados: abandonados.length };
}

export async function revisarCarritosAbandonados() {
  const config = await prisma.tiendanubeConfig.findFirst();
  if (!config) {
    return { ok: false as const, error: "Tienda no configurada" };
  }

  const checkouts = await traerCheckoutsAbandonados(config.storeId, config.accessToken);

  // Un checkout que se completó ya es una orden normal, no un carrito abandonado: ignorarlo.
  const abandonados = checkouts.filter((c) => !c.completed_at);

  const yaNotificados = await prisma.carritoAbandonadoNotificado.findMany({
    where: { checkoutId: { in: abandonados.map((c) => BigInt(c.id)) } },
    select: { checkoutId: true },
  });
  const idsNotificados = new Set(yaNotificados.map((n) => n.checkoutId.toString()));

  const nuevos = abandonados.filter((c) => !idsNotificados.has(String(c.id)));

  for (const checkout of nuevos) {
    const productos = checkout.products.map((p) => `${p.quantity}x ${p.name}`).join(", ");
    const nombre = checkout.contact_name ?? "Cliente sin nombre";
    const contacto = [checkout.contact_phone, checkout.contact_email].filter(Boolean).join(" / ");

    await sendTelegramMessage(
      `🛒 Carrito abandonado #${checkout.id}\n` +
        `${nombre}${contacto ? ` (${contacto})` : ""}\n` +
        `${productos}\n` +
        `Total: $${checkout.total}` +
        (checkout.abandoned_checkout_url ? `\n${checkout.abandoned_checkout_url}` : "")
    );

    await prisma.carritoAbandonadoNotificado.create({
      data: { checkoutId: BigInt(checkout.id) },
    });
  }

  return { ok: true as const, nuevos: nuevos.length, totalAbandonados: abandonados.length };
}
