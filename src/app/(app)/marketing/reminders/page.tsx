import { cookies } from "next/headers";
import { StatusReminder, TipoMascota } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { RemindersTabla, type FilaReminder } from "./reminders-tabla";
import { SwitchStatusTodos } from "./switch-status-todos";

const TIPO_LABEL: Record<TipoMascota, string> = {
  PERRO: "Perro",
  GATO: "Gato",
};

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
  const [mascotas, clientesSinMascota] = await Promise.all([
    prisma.mascota.findMany({
      orderBy: [{ cliente: { nombre: "asc" } }, { cliente: { apellido: "asc" } }, { nombre: "asc" }],
      select: {
        id: true,
        nombre: true,
        tipo: true,
        raza: true,
        setupReminderDias: true,
        statusReminder: true,
        cliente: {
          select: {
            nombre: true,
            apellido: true,
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
        setupReminderDias: true,
        statusReminder: true,
        ...ultimaVentaSelect,
      },
    }),
  ]);

  const clientesPendientes = clientesSinMascota.length;

  const filasMascotas: FilaReminder[] = mascotas.map((m) => {
    const ultimaVenta = m.cliente.ventas[0];
    return {
      key: `m-${m.id}`,
      destino: "mascota",
      id: m.id,
      cliente: `${m.cliente.nombre} ${m.cliente.apellido}`,
      mascota: m.nombre,
      tipo: TIPO_LABEL[m.tipo],
      raza: m.raza,
      ultimaVentaId: ultimaVenta?.id ?? null,
      ultimaVentaFecha: ultimaVenta ? diaArgentina.format(ultimaVenta.fechaVenta) : null,
      setupReminderDias: m.setupReminderDias,
      statusReminder: m.statusReminder,
    };
  });

  // Clientes sin mascota: setup y status se guardan en el Cliente.
  const filasClientes: FilaReminder[] = clientesSinMascota.map((c) => {
    const ultimaVenta = c.ventas[0];
    return {
      key: `c-${c.id}`,
      destino: "cliente",
      id: c.id,
      cliente: `${c.nombre} ${c.apellido}`,
      mascota: null,
      tipo: null,
      raza: null,
      ultimaVentaId: ultimaVenta?.id ?? null,
      ultimaVentaFecha: ultimaVenta ? diaArgentina.format(ultimaVenta.fechaVenta) : null,
      setupReminderDias: c.setupReminderDias,
      statusReminder: c.statusReminder,
    };
  });

  const filas = [...filasMascotas, ...filasClientes].sort(
    (a, b) => a.cliente.localeCompare(b.cliente, "es") || (a.mascota ?? "").localeCompare(b.mascota ?? "", "es"),
  );

  // Totales sobre todas las filas (mascotas y clientes sin mascota).
  const activos = filas.filter((f) => f.statusReminder === "ACTIVO").length;
  const pausados = filas.length - activos;

  // Estado del switch según su último clic (cookie); si nunca se usó, según los datos.
  const cookieSwitch = (await cookies()).get("reminders-switch-status")?.value;
  const ultimoClic: StatusReminder = Object.values(StatusReminder).includes(cookieSwitch as StatusReminder)
    ? (cookieSwitch as StatusReminder)
    : filas.length > 0 && pausados === 0
      ? "ACTIVO"
      : "PAUSADO";

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Marketing — Reminders</h1>
        <div className="mt-1 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            Total Reminders: Activos {activos} / Pausados: {pausados} / Clientes/Mascotas pendientes: {clientesPendientes}
          </p>
          <SwitchStatusTodos ultimoClic={ultimoClic} />
        </div>
      </div>
      <RemindersTabla filas={filas} hoy={diaArgentina.format(new Date())} />
    </div>
  );
}
