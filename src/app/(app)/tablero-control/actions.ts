"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import type { EstadoTablero } from "@prisma/client";
import { COLUMNAS } from "./columnas";

const ESTADOS_VALIDOS = new Set(COLUMNAS.map((c) => c.estado));

export async function crearTarjeta(formData: FormData) {
  await requireAuth();

  const titulo = String(formData.get("titulo") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();
  if (!titulo) return;

  const ultima = await prisma.tarjetaTablero.findFirst({
    where: { estado: "INGRESO_ORDEN_PENDIENTE" },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  await prisma.tarjetaTablero.create({
    data: {
      titulo,
      notas: notas || null,
      estado: "INGRESO_ORDEN_PENDIENTE",
      orden: (ultima?.orden ?? 0) + 1,
    },
  });

  revalidatePath("/tablero-control");
}

export async function moverTarjeta(id: number, nuevoEstado: EstadoTablero) {
  await requireAuth();

  if (!ESTADOS_VALIDOS.has(nuevoEstado)) return;

  const ultima = await prisma.tarjetaTablero.findFirst({
    where: { estado: nuevoEstado },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  await prisma.tarjetaTablero.update({
    where: { id },
    data: { estado: nuevoEstado, orden: (ultima?.orden ?? 0) + 1 },
  });

  revalidatePath("/tablero-control");
}

export async function eliminarTarjeta(formData: FormData) {
  await requireAuth();

  const id = Number(formData.get("id"));
  if (!id) return;

  await prisma.tarjetaTablero.delete({ where: { id } });

  revalidatePath("/tablero-control");
}
