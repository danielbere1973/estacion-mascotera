"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { TipoProductoMayorista } from "@prisma/client";

export async function actualizarMargenMayorista(formData: FormData) {
  await requireAdmin("MAYORISTA_MARGENES");

  const tipoProducto = formData.get("tipoProducto")?.toString() as TipoProductoMayorista;
  const margenPorcentaje = Number(formData.get("margenPorcentaje"));
  const margenPorcentajeTramo2Raw = formData.get("margenPorcentajeTramo2")?.toString().trim();
  const umbralKgTramo2Raw = formData.get("umbralKgTramo2")?.toString().trim();

  if (!tipoProducto) throw new Error("Tipo de producto inválido.");
  if (!Number.isFinite(margenPorcentaje) || margenPorcentaje < 0) throw new Error("Margen inválido.");

  const margenPorcentajeTramo2 = margenPorcentajeTramo2Raw ? Number(margenPorcentajeTramo2Raw) : null;
  const umbralKgTramo2 = umbralKgTramo2Raw ? Number(umbralKgTramo2Raw) : null;

  await prisma.margenMayorista.upsert({
    where: { tipoProducto },
    create: { tipoProducto, margenPorcentaje, margenPorcentajeTramo2, umbralKgTramo2 },
    update: { margenPorcentaje, margenPorcentajeTramo2, umbralKgTramo2 },
  });

  revalidatePath("/inventario/mayoristas-margenes");
}
