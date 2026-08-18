"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { PALETA_COLORES } from "./columnas";

export async function crearTarjeta(formData: FormData) {
  await requireAuth();

  const titulo = String(formData.get("titulo") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();
  if (!titulo) return;

  const primeraColumna = await prisma.columnaTablero.findFirst({
    orderBy: { orden: "asc" },
  });
  if (!primeraColumna) return;

  const ultima = await prisma.tarjetaTablero.findFirst({
    where: { columnaId: primeraColumna.id },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  await prisma.tarjetaTablero.create({
    data: {
      titulo,
      notas: notas || null,
      columnaId: primeraColumna.id,
      orden: (ultima?.orden ?? 0) + 1,
    },
  });

  revalidatePath("/tablero-control");
}

export async function moverTarjeta(id: number, columnaId: number) {
  await requireAuth();

  const columnaExiste = await prisma.columnaTablero.findUnique({ where: { id: columnaId } });
  if (!columnaExiste) return;

  const ultima = await prisma.tarjetaTablero.findFirst({
    where: { columnaId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  await prisma.tarjetaTablero.update({
    where: { id },
    data: { columnaId, orden: (ultima?.orden ?? 0) + 1 },
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

export async function crearColumna(formData: FormData) {
  await requireAuth();

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return;

  // Reintenta si otra request creó una columna al mismo tiempo y chocó
  // contra el @@unique([orden]) (evita duplicar el orden, no el contenido).
  for (let intento = 0; intento < 5; intento++) {
    const [ultima, cantidad] = await Promise.all([
      prisma.columnaTablero.findFirst({ orderBy: { orden: "desc" }, select: { orden: true } }),
      prisma.columnaTablero.count(),
    ]);

    try {
      await prisma.columnaTablero.create({
        data: {
          nombre,
          orden: (ultima?.orden ?? 0) + 1,
          color: PALETA_COLORES[cantidad % PALETA_COLORES.length],
        },
      });
      break;
    } catch (error) {
      const esConflicto = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!esConflicto || intento === 4) throw error;
    }
  }

  revalidatePath("/tablero-control");
}

export async function reordenarColumnas(idsEnOrden: number[]) {
  await requireAuth();

  await prisma.$transaction(
    idsEnOrden.map((id, index) =>
      prisma.columnaTablero.update({ where: { id }, data: { orden: index } })
    )
  );

  revalidatePath("/tablero-control");
}

export async function eliminarColumna(id: number) {
  await requireAuth();

  // onDelete: Cascade en el schema borra también las tarjetas de esa columna.
  await prisma.columnaTablero.delete({ where: { id } });

  revalidatePath("/tablero-control");
}

export async function editarColumna(id: number, nombre: string) {
  await requireAuth();

  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) return;

  await prisma.columnaTablero.update({ where: { id }, data: { nombre: nombreLimpio } });

  revalidatePath("/tablero-control");
}

export async function editarTarjeta(formData: FormData) {
  await requireAuth();

  const id = Number(formData.get("id"));
  const titulo = String(formData.get("titulo") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();
  const usuarioAsignadoIdRaw = String(formData.get("usuarioAsignadoId") ?? "");
  const ventaIdRaw = String(formData.get("ventaId") ?? "");
  if (!id || !titulo) return;

  await prisma.tarjetaTablero.update({
    where: { id },
    data: {
      titulo,
      notas: notas || null,
      usuarioAsignadoId: usuarioAsignadoIdRaw ? Number(usuarioAsignadoIdRaw) : null,
      ventaId: ventaIdRaw ? Number(ventaIdRaw) : null,
    },
  });

  revalidatePath("/tablero-control");
}
