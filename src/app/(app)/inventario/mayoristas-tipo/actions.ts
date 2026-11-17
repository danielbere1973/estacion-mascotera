"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { TipoProductoMayorista } from "@prisma/client";

export async function actualizarTipoProductoMayorista(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Producto inválido.");

  const raw = formData.get("tipoProductoMayorista")?.toString();
  const tipoProductoMayorista = raw ? (raw as TipoProductoMayorista) : null;

  await prisma.producto.update({
    where: { id },
    data: { tipoProductoMayorista },
  });

  revalidatePath("/inventario/mayoristas-tipo");
}

export async function actualizarTipoProductoMayoristaMasivo(formData: FormData) {
  await requireAdmin();

  const ids = formData.getAll("productoIds").map((v) => Number(v)).filter(Boolean);
  if (ids.length === 0) throw new Error("No hay productos seleccionados.");

  const raw = formData.get("tipoProductoMayorista")?.toString();
  const tipoProductoMayorista = raw ? (raw as TipoProductoMayorista) : null;

  await prisma.producto.updateMany({
    where: { id: { in: ids } },
    data: { tipoProductoMayorista },
  });

  revalidatePath("/inventario/mayoristas-tipo");
}
