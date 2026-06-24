"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function crearMedioPago(formData: FormData) {
  await requireAdmin();
  const nombre = formData.get("nombre")?.toString().trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");
  await prisma.medioPago.create({ data: { nombre } });
  revalidatePath("/admin/medios-pago");
}

export async function toggleMedioPago(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const activo = formData.get("activo") === "true";
  await prisma.medioPago.update({ where: { id }, data: { activo: !activo } });
  revalidatePath("/admin/medios-pago");
}

export async function eliminarMedioPago(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await prisma.medioPago.delete({ where: { id } });
  revalidatePath("/admin/medios-pago");
}
