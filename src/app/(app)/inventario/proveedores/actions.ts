"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function crearProveedor(formData: FormData) {
  await requireAdmin();
  const nombre = formData.get("nombre")?.toString().trim();
  const contacto = formData.get("contacto")?.toString().trim() || null;
  const direccion = formData.get("direccion")?.toString().trim() || null;
  const email = formData.get("email")?.toString().trim() || null;
  const cuit = formData.get("cuit")?.toString().trim() || null;
  const alias = formData.get("alias")?.toString().trim() || null;
  const cbu = formData.get("cbu")?.toString().trim() || null;
  const accountManager = formData.get("accountManager")?.toString().trim() || null;
  const horarios = formData.get("horarios")?.toString().trim() || null;
  if (!nombre) throw new Error("El nombre es requerido.");
  await prisma.proveedor.create({ data: { nombre, contacto, email, cuit, alias, cbu, direccion, accountManager, horarios } });
  revalidatePath("/inventario/proveedores");
  revalidatePath("/proveedores");
}

export async function actualizarProveedor(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const nombre = formData.get("nombre")?.toString().trim();
  const contacto = formData.get("contacto")?.toString().trim() || null;
  const direccion = formData.get("direccion")?.toString().trim() || null;
  const email = formData.get("email")?.toString().trim() || null;
  const cuit = formData.get("cuit")?.toString().trim() || null;
  const alias = formData.get("alias")?.toString().trim() || null;
  const cbu = formData.get("cbu")?.toString().trim() || null;
  const accountManager = formData.get("accountManager")?.toString().trim() || null;
  const horarios = formData.get("horarios")?.toString().trim() || null;
  if (!id || !nombre) throw new Error("Datos inválidos.");
  await prisma.proveedor.update({ where: { id }, data: { nombre, contacto, email, cuit, alias, cbu, direccion, accountManager, horarios } });
  revalidatePath("/inventario/proveedores");
  revalidatePath("/proveedores");
  // Se puede editar desde Inventario o desde el módulo Proveedores: vuelve a donde vino.
  redirect(formData.get("volver") === "/proveedores" ? "/proveedores" : "/inventario/proveedores");
}

export async function eliminarProveedor(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Proveedor inválido.");
  const tiene = await prisma.historialStockMayorista.count({ where: { proveedorId: id } });
  if (tiene > 0) throw new Error("No se puede eliminar un proveedor con productos asociados.");
  await prisma.proveedor.delete({ where: { id } });
  revalidatePath("/inventario/proveedores");
}
