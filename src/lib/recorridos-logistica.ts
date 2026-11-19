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
  usuario: string;
  km: number;
  costo: number;
  estado: EstadoSeguimiento;
};

export async function traerCostoPorKm(): Promise<number> {
  const config = await prisma.configLogistica.findUnique({ where: { id: 1 } });
  return config ? Number(config.costoPorKm) : 0;
}

export async function traerRecorridos(filtro: FiltroRecorridos, costoPorKm: number): Promise<Recorrido[]> {
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
      cliente: { select: { nombre: true, apellido: true } },
      usuario: { select: { nombre: true, apellido: true } },
    },
  });

  const ahora = new Date();
  return seguimientos.map((s) => {
    const estado = estadoSeguimiento(s);
    // Fin: cuando se dejó de compartir; si venció, la última ubicación recibida; si sigue, ahora.
    const fin =
      s.finalizadoAt ??
      (estado === "VENCIDO" ? new Date(Math.min((s.ubicacionAt ?? s.venceAt).getTime(), s.venceAt.getTime())) : ahora);
    return {
      id: s.id,
      inicio: s.createdAt,
      fin,
      minutos: Math.max(0, Math.round((fin.getTime() - s.createdAt.getTime()) / 60000)),
      cliente: `${s.cliente.apellido}, ${s.cliente.nombre}`,
      usuario: `${s.usuario.nombre} ${s.usuario.apellido}`,
      km: s.kmRecorridos,
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
