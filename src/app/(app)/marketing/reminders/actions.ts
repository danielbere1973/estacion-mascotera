"use server";

import { revalidatePath } from "next/cache";
import { StatusReminder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

// Los reminders se configuran por mascota, o por cliente cuando no tiene mascotas.
export type DestinoReminder = "mascota" | "cliente";

const STATUS_LABEL: Record<StatusReminder, string> = { ACTIVO: "Activo", PAUSADO: "Pausado" };

// Registra un evento en el Event log de Marketing. Si falla, no corta la acción.
async function registrarEvento(usuarioId: number, accion: string, detalle: string, resultado: string) {
  try {
    await prisma.logMarketing.create({ data: { usuarioId, accion, detalle, resultado } });
  } catch (e) {
    console.error("No se pudo registrar el evento de Marketing", e);
  }
}

function mensajeError(e: unknown) {
  return `Error: ${e instanceof Error ? e.message : String(e)}`;
}

// Estado actual de la fila, con un nombre para el log ("Firulais (Ariel Bak)").
async function leerDestino(destino: DestinoReminder, id: number) {
  if (destino === "mascota") {
    const m = await prisma.mascota.findUnique({
      where: { id },
      select: {
        nombre: true,
        setupReminderDias: true,
        statusReminder: true,
        cliente: { select: { nombre: true, apellido: true } },
      },
    });
    return m && { ...m, nombre: `${m.nombre} (${m.cliente.nombre} ${m.cliente.apellido})` };
  }
  const c = await prisma.cliente.findUnique({
    where: { id },
    select: { nombre: true, apellido: true, setupReminderDias: true, statusReminder: true },
  });
  return c && { ...c, nombre: `${c.nombre} ${c.apellido} (sin mascota)` };
}

async function actualizarReminder(
  destino: DestinoReminder,
  id: number,
  data: { setupReminderDias?: number; statusReminder?: StatusReminder },
) {
  if (destino === "mascota") await prisma.mascota.update({ where: { id }, data });
  else if (destino === "cliente") await prisma.cliente.update({ where: { id }, data });
  revalidatePath("/marketing/reminders");
}

export async function actualizarSetupReminder(destino: DestinoReminder, id: number, dias: string) {
  const session = await requireAdmin();
  const usuarioId = Number(session.user.id);
  const accion = "Cambio de Setup reminder";
  const actual = await leerDestino(destino, id);
  const nombre = actual?.nombre ?? `${destino} #${id}`;
  // Obligatorio y mínimo 1 día.
  const n = Number.parseInt(dias, 10);
  if (!Number.isFinite(n) || n < 1) {
    await registrarEvento(usuarioId, accion, `${nombre}: "${dias}"`, "Error: valor inválido (mínimo 1)");
    return;
  }
  const detalle = `${nombre}: ${actual?.setupReminderDias ?? "-"} → ${n} días`;
  try {
    await actualizarReminder(destino, id, { setupReminderDias: n });
    await registrarEvento(usuarioId, accion, detalle, "OK");
  } catch (e) {
    await registrarEvento(usuarioId, accion, detalle, mensajeError(e));
    throw e;
  }
}

export async function actualizarStatusReminder(destino: DestinoReminder, id: number, status: string) {
  const session = await requireAdmin();
  const usuarioId = Number(session.user.id);
  const accion = "Cambio de Status";
  const actual = await leerDestino(destino, id);
  const nombre = actual?.nombre ?? `${destino} #${id}`;
  if (!Object.values(StatusReminder).includes(status as StatusReminder)) {
    await registrarEvento(usuarioId, accion, `${nombre}: "${status}"`, "Error: status inválido");
    return;
  }
  const anterior = actual ? STATUS_LABEL[actual.statusReminder] : "-";
  const detalle = `${nombre}: ${anterior} → ${STATUS_LABEL[status as StatusReminder]}`;
  try {
    await actualizarReminder(destino, id, { statusReminder: status as StatusReminder });
    await registrarEvento(usuarioId, accion, detalle, "OK");
  } catch (e) {
    await registrarEvento(usuarioId, accion, detalle, mensajeError(e));
    throw e;
  }
}

export async function actualizarStatusReminderTodos(status: string) {
  const session = await requireAdmin();
  const usuarioId = Number(session.user.id);
  if (!Object.values(StatusReminder).includes(status as StatusReminder)) {
    await registrarEvento(usuarioId, "Switch", `"${status}"`, "Error: status inválido");
    return;
  }
  const switchStatus = status as StatusReminder;
  const accion = `Switch to ${STATUS_LABEL[switchStatus]}`;
  const data = { statusReminder: switchStatus };
  try {
    // Se guarda el último clic para que el botón no cambie con los cambios manuales de Status.
    const [mascotas, clientes] = await prisma.$transaction([
      prisma.mascota.updateMany({ data }),
      prisma.cliente.updateMany({ data }),
      prisma.configReminders.upsert({ where: { id: 1 }, create: { id: 1, switchStatus }, update: { switchStatus } }),
    ]);
    await registrarEvento(
      usuarioId,
      accion,
      `Todos a ${STATUS_LABEL[switchStatus]}: ${mascotas.count} mascotas y ${clientes.count} clientes actualizados`,
      "OK",
    );
  } catch (e) {
    await registrarEvento(usuarioId, accion, `Todos a ${STATUS_LABEL[switchStatus]}`, mensajeError(e));
    throw e;
  }
  revalidatePath("/marketing/reminders");
}
