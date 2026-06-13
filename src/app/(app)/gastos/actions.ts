"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { CategoriaGasto } from "@prisma/client";

export async function crearGasto(formData: FormData) {
  const session = await requireAdmin();

  const categoriaGasto = formData.get("categoriaGasto")?.toString() as CategoriaGasto;
  const monto = Number(formData.get("monto"));
  const descripcion = formData.get("descripcion")?.toString().trim() || null;
  const fechaGastoStr = formData.get("fechaGasto")?.toString();
  const pagadoPorIdStr = formData.get("pagadoPorId")?.toString();

  if (!categoriaGasto) throw new Error("Seleccioná una categoría.");
  if (!monto || monto <= 0) throw new Error("El monto debe ser mayor a 0.");

  await prisma.gasto.create({
    data: {
      categoriaGasto,
      monto,
      descripcion,
      fechaGasto: fechaGastoStr ? new Date(fechaGastoStr) : new Date(),
      usuarioId: Number(session.user.id),
      pagadoPorId: pagadoPorIdStr ? Number(pagadoPorIdStr) : null,
    },
  });

  revalidatePath("/gastos");
  revalidatePath("/");
}

export async function actualizarGasto(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Gasto inválido.");

  const categoriaGasto = formData.get("categoriaGasto")?.toString() as CategoriaGasto;
  const monto = Number(formData.get("monto"));
  const descripcion = formData.get("descripcion")?.toString().trim() || null;
  const fechaGastoStr = formData.get("fechaGasto")?.toString();
  const pagadoPorIdStr = formData.get("pagadoPorId")?.toString();

  if (!categoriaGasto) throw new Error("Seleccioná una categoría.");
  if (!monto || monto <= 0) throw new Error("El monto debe ser mayor a 0.");

  await prisma.gasto.update({
    where: { id },
    data: {
      categoriaGasto,
      monto,
      descripcion,
      fechaGasto: fechaGastoStr ? new Date(fechaGastoStr) : new Date(),
      pagadoPorId: pagadoPorIdStr ? Number(pagadoPorIdStr) : null,
    },
  });

  revalidatePath("/gastos");
  revalidatePath("/");
  redirect("/gastos");
}

export async function eliminarGasto(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Gasto inválido.");

  await prisma.gasto.delete({ where: { id } });

  revalidatePath("/gastos");
  revalidatePath("/");
}
