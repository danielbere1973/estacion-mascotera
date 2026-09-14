"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { registrarLog } from "@/lib/log";

export async function crearUsoInterno(formData: FormData) {
  const session = await requireAdmin();

  const productoId = Number(formData.get("productoId"));
  const cantidad = Number(formData.get("cantidad"));
  const descripcion = formData.get("descripcion")?.toString().trim() || null;
  const fechaStr = formData.get("fecha")?.toString();
  const pagadoPorIdStr = formData.get("pagadoPorId")?.toString();

  if (!productoId) throw new Error("Seleccioná un producto.");
  if (!cantidad || cantidad <= 0) throw new Error("La cantidad debe ser mayor a 0.");

  await prisma.$transaction(async (tx) => {
    const producto = await tx.producto.findUniqueOrThrow({ where: { id: productoId } });

    const monto = Number(producto.precioCostoUnitario) * cantidad;

    await tx.producto.update({
      where: { id: productoId },
      data: { stockActual: { decrement: cantidad } },
    });

    const gasto = await tx.gasto.create({
      data: {
        categoriaGasto: "Publicidad",
        tipoGasto: "MARKETING",
        esFijo: false,
        monto,
        descripcion: descripcion
          ? `Uso interno: ${cantidad}x ${producto.nombre} — ${descripcion}`
          : `Uso interno: ${cantidad}x ${producto.nombre}`,
        fechaGasto: fechaStr ? new Date(fechaStr) : new Date(),
        usuarioId: Number(session.user.id),
        pagadoPorId: pagadoPorIdStr ? Number(pagadoPorIdStr) : null,
      },
    });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "CREAR",
      entidad: "GASTO",
      entidadId: gasto.id,
      detalle: `Uso interno: ${cantidad}x ${producto.nombre} - $${monto}`,
    });
  });

  revalidatePath("/gastos");
  revalidatePath("/inventario");
  revalidatePath("/");
  redirect("/gastos");
}
