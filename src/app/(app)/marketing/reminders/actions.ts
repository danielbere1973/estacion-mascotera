"use server";

import { revalidatePath } from "next/cache";
import { StatusReminder, TipoMascota } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { enviarMailsIndividuales } from "@/lib/mail";
import { asuntoReminder, clientesParaReminder, htmlReminder } from "@/lib/reminders";

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
  // El Status es por cliente: se aplica a todas las mascotas del cliente.
  if (destino === "mascota" && data.statusReminder) {
    const m = await prisma.mascota.findUnique({ where: { id }, select: { clienteId: true } });
    if (m) {
      await prisma.mascota.updateMany({ where: { clienteId: m.clienteId }, data: { statusReminder: data.statusReminder } });
      revalidatePath("/marketing/reminders");
      return;
    }
  }
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
  const detalle =
    `${nombre}: ${anterior} → ${STATUS_LABEL[status as StatusReminder]}` +
    (destino === "mascota" ? " (todas las mascotas del cliente)" : "");
  try {
    await actualizarReminder(destino, id, { statusReminder: status as StatusReminder });
    await registrarEvento(usuarioId, accion, detalle, "OK");
  } catch (e) {
    await registrarEvento(usuarioId, accion, detalle, mensajeError(e));
    throw e;
  }
}

// Datos de la mascota editables desde Reminders; se guardan en la tabla Mascota
// (los mismos que se ven en la ficha del cliente).
export type CampoMascota = "nombre" | "tipo" | "raza";

const CAMPO_LABEL: Record<CampoMascota, string> = { nombre: "Mascota", tipo: "Tipo", raza: "Raza" };
const TIPO_LABEL: Record<TipoMascota, string> = { PERRO: "Perro", GATO: "Gato" };

export async function actualizarDatoMascota(id: number, campo: CampoMascota, valor: string) {
  const session = await requireAdmin();
  const usuarioId = Number(session.user.id);
  const accion = `Cambio de ${CAMPO_LABEL[campo]}`;
  const actual = await prisma.mascota.findUnique({
    where: { id },
    select: {
      clienteId: true,
      nombre: true,
      tipo: true,
      raza: true,
      cliente: { select: { nombre: true, apellido: true } },
    },
  });
  if (!actual) {
    await registrarEvento(usuarioId, accion, `mascota #${id}`, "Error: la mascota no existe");
    return;
  }
  const nombre = `${actual.nombre} (${actual.cliente.nombre} ${actual.cliente.apellido})`;
  const texto = valor.trim();

  let data: { nombre?: string; tipo?: TipoMascota; raza?: string | null };
  let anterior: string;
  let nuevo: string;
  if (campo === "nombre") {
    if (!texto) {
      await registrarEvento(usuarioId, accion, `${nombre}: vacío`, "Error: el nombre es obligatorio");
      return;
    }
    data = { nombre: texto };
    anterior = actual.nombre;
    nuevo = texto;
  } else if (campo === "tipo") {
    if (!Object.values(TipoMascota).includes(texto as TipoMascota)) {
      await registrarEvento(usuarioId, accion, `${nombre}: "${texto}"`, "Error: tipo inválido");
      return;
    }
    data = { tipo: texto as TipoMascota };
    anterior = TIPO_LABEL[actual.tipo];
    nuevo = TIPO_LABEL[texto as TipoMascota];
  } else {
    // Raza es opcional: vacío la borra.
    data = { raza: texto || null };
    anterior = actual.raza ?? "-";
    nuevo = texto || "-";
  }

  const detalle = `${nombre}: ${anterior} → ${nuevo}`;
  try {
    await prisma.mascota.update({ where: { id }, data });
    await registrarEvento(usuarioId, accion, detalle, "OK");
  } catch (e) {
    await registrarEvento(usuarioId, accion, detalle, mensajeError(e));
    throw e;
  }
  revalidatePath("/marketing/reminders");
  revalidatePath(`/clientes/${actual.clienteId}/editar`);
}

// Clientes sin mascota: al completar Mascota y Tipo en Reminders se crea la mascota
// (Edad y Tamaño quedan vacíos). Hereda el Setup y Status que tenía el cliente.
export async function crearMascotaDesdeReminders(clienteId: number, nombre: string, tipo: string, raza: string) {
  const session = await requireAdmin();
  const usuarioId = Number(session.user.id);
  const accion = "Alta de mascota";
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { nombre: true, apellido: true, setupReminderDias: true, statusReminder: true },
  });
  const nombreMascota = nombre.trim();
  const razaMascota = raza.trim() || null;
  const detalle = `${nombreMascota || "-"} (${cliente ? `${cliente.nombre} ${cliente.apellido}` : `cliente #${clienteId}`})`;
  if (!cliente) {
    await registrarEvento(usuarioId, accion, detalle, "Error: el cliente no existe");
    return;
  }
  if (!nombreMascota || !Object.values(TipoMascota).includes(tipo as TipoMascota)) {
    await registrarEvento(usuarioId, accion, detalle, "Error: faltan Mascota o Tipo");
    return;
  }
  const detalleCompleto = `${detalle}: ${TIPO_LABEL[tipo as TipoMascota]}${razaMascota ? `, ${razaMascota}` : ""}`;
  try {
    await prisma.mascota.create({
      data: {
        clienteId,
        nombre: nombreMascota,
        tipo: tipo as TipoMascota,
        raza: razaMascota,
        setupReminderDias: cliente.setupReminderDias,
        statusReminder: cliente.statusReminder,
      },
    });
    await registrarEvento(usuarioId, accion, detalleCompleto, "OK");
  } catch (e) {
    await registrarEvento(usuarioId, accion, detalleCompleto, mensajeError(e));
    throw e;
  }
  revalidatePath("/marketing/reminders");
  revalidatePath(`/clientes/${clienteId}/editar`);
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

// Envía el mail de reminder, uno por cliente, a los que cumplen las condiciones
// (Status Activo y más de 30 días desde la última compra). Cada envío queda en el Event log.
export async function enviarReminders(): Promise<{ enviados: number; errores: number; sinEmail: number }> {
  const session = await requireAdmin();
  const usuarioId = Number(session.user.id);
  const { elegibles, sinEmail } = await clientesParaReminder();

  const resultados = await enviarMailsIndividuales(
    elegibles.map((c) => ({ to: c.email, subject: asuntoReminder(c.nombre), html: htmlReminder(c.nombre) })),
  );

  const eventos = [
    ...elegibles.map((c, i) => ({
      detalle: `${c.nombre} ${c.apellido} <${c.email}> (${c.dias} días desde la última compra)`,
      resultado: resultados[i] ? `Error: ${resultados[i]}` : "OK",
    })),
    ...sinEmail.map((c) => ({ detalle: `${c.nombre} ${c.apellido}`, resultado: "Error: el cliente no tiene email" })),
  ];
  try {
    await prisma.logMarketing.createMany({
      data: eventos.map((e) => ({ usuarioId, accion: "Envío de reminder", ...e })),
    });
  } catch (e) {
    console.error("No se pudieron registrar los envíos de reminders", e);
  }

  // Fecha del último reminder enviado OK, para la columna "Reminder enviado".
  try {
    await prisma.cliente.updateMany({
      where: { id: { in: elegibles.filter((_, i) => resultados[i] === null).map((c) => c.id) } },
      data: { fechaUltimoReminder: new Date() },
    });
  } catch (e) {
    console.error("No se pudo guardar la fecha del último reminder", e);
  }
  revalidatePath("/marketing/reminders");

  const enviados = resultados.filter((r) => r === null).length;
  const errores = elegibles.length - enviados;
  await registrarEvento(
    usuarioId,
    "Envío de reminders",
    `${enviados} enviados, ${errores} con error, ${sinEmail.length} sin email`,
    errores === 0 ? "OK" : `Error: ${errores} envíos fallaron`,
  );
  return { enviados, errores, sinEmail: sinEmail.length };
}
