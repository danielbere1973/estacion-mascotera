"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function actualizarCliente(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Cliente inválido.");

  const nombre = formData.get("nombre")?.toString().trim();
  const apellido = formData.get("apellido")?.toString().trim();
  const direccion = formData.get("direccion")?.toString().trim();
  const telefono = formData.get("telefono")?.toString().trim();
  const email = formData.get("email")?.toString().trim() || null;

  if (!nombre || !apellido || !direccion || !telefono) {
    throw new Error("Faltan datos obligatorios.");
  }

  await prisma.cliente.update({
    where: { id },
    data: { nombre, apellido, direccion, telefono, email },
  });

  revalidatePath("/clientes");
  revalidatePath("/ventas");
  redirect("/clientes");
}
