// Cuánto dura un link de seguimiento desde que se comparte.
export const DURACION_SEGUIMIENTO_MS = 60 * 60 * 1000;

// Cada cuánto se manda la posición al servidor y cada cuánto la consulta la
// página del cliente.
export const INTERVALO_ACTUALIZACION_MS = 10 * 1000;

export type EstadoSeguimiento = "ACTIVO" | "FINALIZADO" | "VENCIDO";

export function estadoSeguimiento(s: { venceAt: Date; finalizadoAt: Date | null }): EstadoSeguimiento {
  if (s.finalizadoAt) return "FINALIZADO";
  if (s.venceAt.getTime() <= Date.now()) return "VENCIDO";
  return "ACTIVO";
}
