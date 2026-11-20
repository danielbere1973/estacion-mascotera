// Rango de fechas de Dashboard 2 y su detalle, a partir de ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD.
// Las fechas se interpretan en UTC, igual que los cortes de mes del Dashboard y del Cashflow.

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const aIso = (d: Date) => d.toISOString().slice(0, 10);

function leerFecha(valor: string | undefined): Date | null {
  if (!valor || !FECHA.test(valor)) return null;
  const d = new Date(`${valor}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Sin fechas elegidas: desde el 1 del mes actual hasta hoy. "Hasta" incluye ese día completo
// (hastaExclusivo es el día siguiente). Si vienen invertidas, se acomodan.
export function rangoDesdeParams(params: { desde?: string; hasta?: string }) {
  // "Hoy" con la fecha de Argentina (de noche en UTC ya es el día siguiente).
  const hoyAr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const hoy = new Date(`${hoyAr}T00:00:00Z`);
  let desde = leerFecha(params.desde) ?? new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  let hasta = leerFecha(params.hasta) ?? hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  const hastaExclusivo = new Date(hasta.getTime() + 24 * 60 * 60 * 1000);
  return { desde, hasta, hastaExclusivo };
}

// Link al detalle de un concepto, con el mismo rango de fechas.
export function hrefDetalle(concepto: string, desde: Date, hasta: Date, extra: Record<string, string> = {}) {
  const sp = new URLSearchParams({ concepto, desde: aIso(desde), hasta: aIso(hasta), ...extra });
  return `/dashboard-2/detalle?${sp}`;
}
