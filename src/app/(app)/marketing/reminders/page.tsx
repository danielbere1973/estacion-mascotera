import { TipoMascota } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { RemindersTabla, type FilaReminder } from "./reminders-tabla";

const TIPO_LABEL: Record<TipoMascota, string> = {
  PERRO: "Perro",
  GATO: "Gato",
};

// Día calendario en Argentina (YYYY-MM-DD), para que una venta de noche no
// caiga en el día siguiente por estar guardada en UTC.
const diaArgentina = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

export default async function RemindersPage() {
  await requireAdmin();

  // Una fila por mascota; "Última compra" es la venta más reciente del cliente.
  const mascotas = await prisma.mascota.findMany({
    orderBy: [{ cliente: { nombre: "asc" } }, { cliente: { apellido: "asc" } }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      tipo: true,
      raza: true,
      setupReminderDias: true,
      cliente: {
        select: {
          nombre: true,
          apellido: true,
          ventas: { orderBy: { fechaVenta: "desc" }, take: 1, select: { id: true, fechaVenta: true } },
        },
      },
    },
  });

  const filas: FilaReminder[] = mascotas.map((m) => {
    const ultimaVenta = m.cliente.ventas[0];
    return {
      mascotaId: m.id,
      cliente: `${m.cliente.nombre} ${m.cliente.apellido}`,
      mascota: m.nombre,
      tipo: TIPO_LABEL[m.tipo],
      raza: m.raza,
      ultimaVentaId: ultimaVenta?.id ?? null,
      ultimaVentaFecha: ultimaVenta ? diaArgentina.format(ultimaVenta.fechaVenta) : null,
      setupReminderDias: m.setupReminderDias,
    };
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-900">Marketing — Reminders</h1>
      <RemindersTabla filas={filas} />
    </div>
  );
}
