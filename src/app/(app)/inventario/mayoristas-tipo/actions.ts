"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { TipoProductoMayorista } from "@prisma/client";
import { TAG_CACHE_TIENDANUBE } from "@/lib/tiendanube-cache";

// "Force update con Tienda Nube": borra la caché de 10 minutos de Tiendanube (nombre, foto y
// categorías) para que el Catálogo mayorista los traiga de nuevo en su próxima carga.
export async function forzarActualizacionTiendanube() {
  await requireAdmin("MAYORISTA_TIPO");
  updateTag(TAG_CACHE_TIENDANUBE);
  revalidatePath("/inventario/mayoristas-catalogo");
}

export async function actualizarTipoProductoMayorista(formData: FormData) {
  await requireAdmin("MAYORISTA_TIPO");

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
  await requireAdmin("MAYORISTA_TIPO");

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
