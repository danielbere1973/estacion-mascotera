"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function crearTipoProducto(formData: FormData) {
  await requireAdmin();

  const nombre = formData.get("nombre")?.toString().trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");

  await prisma.tipoProducto.create({ data: { nombre } });
  revalidatePath("/inventario/tipos");
}

export async function eliminarTipoProducto(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Tipo inválido.");

  const tipo = await prisma.tipoProducto.findUnique({ where: { id } });
  if (!tipo) throw new Error("Tipo no encontrado.");

  const productosConTipo = await prisma.producto.count({ where: { categoria: tipo.nombre } });
  if (productosConTipo > 0) {
    throw new Error(`No se puede eliminar: ${productosConTipo} producto(s) usan esta categoría.`);
  }

  await prisma.tipoProducto.delete({ where: { id } });
  revalidatePath("/inventario/tipos");
}
