"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { DURACION_SEGUIMIENTO_MS } from "@/lib/seguimiento";

type Posicion = { latitud: number; longitud: number; precision: number | null };

function posicionValida(p: Posicion) {
  return (
    Number.isFinite(p.latitud) &&
    Number.isFinite(p.longitud) &&
    Math.abs(p.latitud) <= 90 &&
    Math.abs(p.longitud) <= 180
  );
}

// Arranca un seguimiento nuevo para el cliente. Si el mismo usuario tenía otro
// activo se finaliza: un celular manda una sola ubicación a la vez.
export async function iniciarSeguimiento(clienteId: number, posicion: Posicion) {
  const session = await requireAuth();
  const usuarioId = Number(session.user.id);
  if (!posicionValida(posicion)) throw new Error("Ubicación inválida.");

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { nombre: true, telefono: true },
  });
  if (!cliente) throw new Error("Cliente no encontrado.");

  const ahora = new Date();
  const [, seguimiento] = await prisma.$transaction([
    prisma.seguimientoUbicacion.updateMany({
      where: { usuarioId, finalizadoAt: null, venceAt: { gt: ahora } },
      data: { finalizadoAt: ahora },
    }),
    prisma.seguimientoUbicacion.create({
      data: {
        token: randomBytes(16).toString("base64url"),
        clienteId,
        usuarioId,
        latitud: posicion.latitud,
        longitud: posicion.longitud,
        precision: posicion.precision,
        ubicacionAt: ahora,
        venceAt: new Date(ahora.getTime() + DURACION_SEGUIMIENTO_MS),
      },
      select: { id: true, token: true, venceAt: true },
    }),
  ]);

  revalidatePath("/logistica");
  return { ...seguimiento, clienteNombre: cliente.nombre, clienteTelefono: cliente.telefono };
}

// Devuelve false si el seguimiento ya no está activo (venció o lo finalizaron
// desde otro lado), para que el celular deje de mandar posiciones.
export async function actualizarUbicacion(token: string, posicion: Posicion) {
  const session = await requireAuth();
  if (!posicionValida(posicion)) return true;
  const { count } = await prisma.seguimientoUbicacion.updateMany({
    where: {
      token,
      usuarioId: Number(session.user.id),
      finalizadoAt: null,
      venceAt: { gt: new Date() },
    },
    data: {
      latitud: posicion.latitud,
      longitud: posicion.longitud,
      precision: posicion.precision,
      ubicacionAt: new Date(),
    },
  });
  return count > 0;
}

// Seguimientos activos de todo el equipo, para la lista y el mapa general de
// Logística (solo usuarios logueados; el cliente nunca ve esto).
export async function listarSeguimientosActivos() {
  await requireAuth();
  return prisma.seguimientoUbicacion.findMany({
    where: { finalizadoAt: null, venceAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      usuarioId: true,
      latitud: true,
      longitud: true,
      precision: true,
      ubicacionAt: true,
      venceAt: true,
      cliente: { select: { nombre: true, apellido: true, telefono: true } },
      usuario: { select: { nombre: true, apellido: true } },
    },
  });
}

export async function finalizarSeguimiento(id: number) {
  await requireAuth();
  await prisma.seguimientoUbicacion.updateMany({
    where: { id, finalizadoAt: null },
    data: { finalizadoAt: new Date() },
  });
  revalidatePath("/logistica");
}
