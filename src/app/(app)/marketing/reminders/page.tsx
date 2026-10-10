import type { StatusReminder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import type { FilaReminder } from "./reminders-tabla";
import { RemindersVista } from "./reminders-vista";
import { SwitchStatusTodos } from "./switch-status-todos";
import { EnviarReminders } from "./enviar-reminders";
import { SwitchEnvioAutomatico } from "./switch-envio-automatico";
import { clientesParaReminder } from "@/lib/reminders";

// Día calendario en Argentina (YYYY-MM-DD), para que una venta de noche no
// caiga en el día siguiente por estar guardada en UTC.
const diaArgentina = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

export default async function RemindersPage() {
  await requireAdmin();

  // Una fila por mascota, más una por cada cliente sin mascotas cargadas.
  // "Última compra" es la venta más reciente del cliente.
  const ultimaVentaSelect = {
    ventas: { orderBy: { fechaVenta: "desc" }, take: 1, select: { id: true, fechaVenta: true } },
  } as const;
  const [mascotas, clientesSinMascota, config, paraReminder, emailsClientes] = await Promise.all([
    prisma.mascota.findMany({
      orderBy: [{ cliente: { nombre: "asc" } }, { cliente: { apellido: "asc" } }, { nombre: "asc" }],
      select: {
        id: true,
        clienteId: true,
        nombre: true,
        tipo: true,
        raza: true,
        setupReminderDias: true,
        statusReminder: true,
        cliente: {
          select: {
            nombre: true,
            apellido: true,
            email: true,
            fechaUltimoReminder: true,
            ...ultimaVentaSelect,
          },
        },
      },
    }),
    prisma.cliente.findMany({
      where: { mascotas: { none: {} } },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        fechaUltimoReminder: true,
        setupReminderDias: true,
        statusReminder: true,
        ...ultimaVentaSelect,
      },
    }),
    prisma.configReminders.findUnique({ where: { id: 1 } }),
    clientesParaReminder(),
    prisma.cliente.findMany({ select: { email: true } }),
  ]);

  const clientesPendientes = clientesSinMascota.length;
  // Mismo criterio que la columna Mail: email vacío o solo espacios cuenta como sin mail.
  const clientesSinMail = emailsClientes.filter((c) => !c.email?.trim()).length;

  // Status por cliente (un solo combo por cliente): Activo si alguna de sus mascotas lo está,
  // igual que el criterio de envío.
  const clientesActivos = new Set(mascotas.filter((m) => m.statusReminder === "ACTIVO").map((m) => m.clienteId));

  const filasMascotas: FilaReminder[] = mascotas.map((m) => {
    const ultimaVenta = m.cliente.ventas[0];
    return {
      key: `m-${m.id}`,
      destino: "mascota",
      id: m.id,
      clienteId: m.clienteId,
      cliente: `${m.cliente.nombre} ${m.cliente.apellido}`,
      mascota: m.nombre,
      tipo: m.tipo,
      raza: m.raza,
      tieneEmail: !!m.cliente.email?.trim(),
      ultimoReminderFecha: m.cliente.fechaUltimoReminder ? diaArgentina.format(m.cliente.fechaUltimoReminder) : null,
      ultimaVentaId: ultimaVenta?.id ?? null,
      ultimaVentaFecha: ultimaVenta ? diaArgentina.format(ultimaVenta.fechaVenta) : null,
      setupReminderDias: m.setupReminderDias,
      statusReminder: m.statusReminder,
      statusCliente: clientesActivos.has(m.clienteId) ? "ACTIVO" : "PAUSADO",
    };
  });

  // Clientes sin mascota: setup y status se guardan en el Cliente.
  const filasClientes: FilaReminder[] = clientesSinMascota.map((c) => {
    const ultimaVenta = c.ventas[0];
    return {
      key: `c-${c.id}`,
      destino: "cliente",
      id: c.id,
      clienteId: c.id,
      cliente: `${c.nombre} ${c.apellido}`,
      mascota: null,
      tipo: null,
      raza: null,
      tieneEmail: !!c.email?.trim(),
      ultimoReminderFecha: c.fechaUltimoReminder ? diaArgentina.format(c.fechaUltimoReminder) : null,
      ultimaVentaId: ultimaVenta?.id ?? null,
      ultimaVentaFecha: ultimaVenta ? diaArgentina.format(ultimaVenta.fechaVenta) : null,
      setupReminderDias: c.setupReminderDias,
      statusReminder: c.statusReminder,
      statusCliente: c.statusReminder,
    };
  });

  const filas = [...filasMascotas, ...filasClientes].sort(
    (a, b) => a.cliente.localeCompare(b.cliente, "es") || (a.mascota ?? "").localeCompare(b.mascota ?? "", "es"),
  );

  // Por cliente (un cliente con varias mascotas cuenta una vez), según el Status del combo.
  const statusPorCliente = new Map(filas.map((f) => [f.clienteId, f.statusCliente]));
  const activos = [...statusPorCliente.values()].filter((s) => s === "ACTIVO").length;
  const pausados = statusPorCliente.size - activos;

  // Estado del switch según su último clic (guardado en la base); si nunca se usó, según los datos.
  const ultimoClic: StatusReminder =
    config?.switchStatus ?? (filas.length > 0 && pausados === 0 ? "ACTIVO" : "PAUSADO");

  return (
    <div className="flex h-full flex-col gap-4">
      <RemindersVista
        titulo={
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h1 className="text-xl font-semibold text-gray-900">Marketing — Reminders</h1>
            <SwitchEnvioAutomatico activo={config?.envioAutomatico ?? true} />
          </div>
        }
        subtitulo={
          <p className="text-sm text-gray-500">
            Total Reminders: Activos {activos} -- Pausados: {pausados} -- Clientes/Mascotas pendientes:{" "}
            {clientesPendientes} -- Clientes sin mail: {clientesSinMail}
          </p>
        }
        acciones={
          <>
            <EnviarReminders cantidad={paraReminder.elegibles.length} sinEmail={paraReminder.sinEmail.length} />
            <a
              href="/marketing/reminders/event-log"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-100"
            >
              Event log
            </a>
            <SwitchStatusTodos ultimoClic={ultimoClic} />
          </>
        }
        filas={filas}
        hoy={diaArgentina.format(new Date())}
      />
    </div>
  );
}
