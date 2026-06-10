"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CategoriaGasto } from "@prisma/client";

export async function crearGasto(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const categoriaGasto = formData.get("categoriaGasto")?.toString() as CategoriaGasto;
  const monto = Number(formData.get("monto"));
  const descripcion = formData.get("descripcion")?.toString().trim() || null;
  const fechaGastoStr = formData.get("fechaGasto")?.toString();

  if (!categoriaGasto) throw new Error("Seleccioná una categoría.");
  if (!monto || monto <= 0) throw new Error("El monto debe ser mayor a 0.");

  await prisma.gasto.create({
    data: {
      categoriaGasto,
      monto,
      descripcion,
      fechaGasto: fechaGastoStr ? new Date(fechaGastoStr) : new Date(),
      usuarioId: Number(session.user.id),
    },
  });

  revalidatePath("/gastos");
  revalidatePath("/");
}
