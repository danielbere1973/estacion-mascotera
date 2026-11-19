import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { estadoSeguimiento, type EstadoSeguimiento } from "@/lib/seguimiento";

// Recorridos de Logística > Costos/KM: cada vez que se compartió la ubicación con un cliente.

export type FiltroRecorridos = { desde?: string; hasta?: string; usuarioId?: string };

export type Recorrido = {
  id: number;
  inicio: Date;
  fin: Date;
  minutos: number;
  cliente: string;
  ventaId: number | null;
  usuarioId: number;
  usuario: string;
  auto: string | null;
  km: number;
  costoPorKm: number;
  costo: number;
  estado: EstadoSeguimiento;
};

// Quienes manejan: los que ya compartieron la ubicación alguna vez o tienen un auto cargado.
export async function traerConductores() {
  const usuarios = await prisma.usuario.findMany({
    where: { OR: [{ seguimientos: { some: {} } }, { vehiculo: { isNot: null } }] },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, apellido: true, vehiculo: { select: { auto: true, costoPorKm: true } } },
  });
  return usuarios.map((u) => ({
    id: u.id,
    nombre: `${u.nombre} ${u.apellido}`,
    auto: u.vehiculo?.auto ?? null,
    costoPorKm: u.vehiculo ? Number(u.vehiculo.costoPorKm) : 0,
  }));
}

// Cada viaje se calcula con el costo por km del auto de quien manejó (vigente hoy).
export async function traerRecorridos(filtro: FiltroRecorridos): Promise<Recorrido[]> {
  const where: Prisma.SeguimientoUbicacionWhereInput = {};
  if (filtro.desde || filtro.hasta) {
    // Fechas del filtro en hora de Argentina (UTC-3).
    where.createdAt = {
      ...(filtro.desde ? { gte: new Date(`${filtro.desde}T00:00:00-03:00`) } : {}),
      ...(filtro.hasta ? { lte: new Date(`${filtro.hasta}T23:59:59-03:00`) } : {}),
    };
  }
  if (filtro.usuarioId) where.usuarioId = Number(filtro.usuarioId);

  const seguimientos = await prisma.seguimientoUbicacion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      ubicacionAt: true,
      venceAt: true,
      finalizadoAt: true,
      kmRecorridos: true,
      ventaId: true,
      usuarioId: true,
      cliente: { select: { nombre: true, apellido: true } },
      usuario: {
        select: { nombre: true, apellido: true, vehiculo: { select: { auto: true, costoPorKm: true } } },
      },
    },
  });

  const ahora = new Date();
  return seguimientos.map((s) => {
    const estado = estadoSeguimiento(s);
    // Fin: cuando se dejó de compartir; si venció, la última ubicación recibida; si sigue, ahora.
    const fin =
      s.finalizadoAt ??
      (estado === "VENCIDO" ? new Date(Math.min((s.ubicacionAt ?? s.venceAt).getTime(), s.venceAt.getTime())) : ahora);
    const costoPorKm = s.usuario.vehiculo ? Number(s.usuario.vehiculo.costoPorKm) : 0;
    return {
      id: s.id,
      inicio: s.createdAt,
      fin,
      minutos: Math.max(0, Math.round((fin.getTime() - s.createdAt.getTime()) / 60000)),
      cliente: `${s.cliente.apellido}, ${s.cliente.nombre}`,
      ventaId: s.ventaId,
      usuarioId: s.usuarioId,
      usuario: `${s.usuario.nombre} ${s.usuario.apellido}`,
      auto: s.usuario.vehiculo?.auto ?? null,
      km: s.kmRecorridos,
      costoPorKm,
      costo: s.kmRecorridos * costoPorKm,
      estado,
    };
  });
}

export function formatoDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const ESTADO_LABEL: Record<EstadoSeguimiento, string> = {
  ACTIVO: "En curso",
  FINALIZADO: "Finalizado",
  VENCIDO: "Vencido",
};
