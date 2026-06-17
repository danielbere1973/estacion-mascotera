export function calcularRango(
  periodo: string | undefined,
  desde: string | undefined,
  hasta: string | undefined
): { fechaDesde: Date; fechaHasta: Date; label: string } {
  const now = new Date();

  if (periodo === "dia") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return { fechaDesde: d, fechaHasta: now, label: "Hoy" };
  }

  if (periodo === "semana") {
    const d = new Date(now);
    const day = d.getDay();
    // Monday = 0 offset
    d.setDate(d.getDate() - ((day + 6) % 7));
    d.setHours(0, 0, 0, 0);
    return { fechaDesde: d, fechaHasta: now, label: "Esta semana" };
  }

  if (periodo === "libre" && desde && hasta) {
    const d = new Date(`${desde}T00:00:00`);
    const h = new Date(`${hasta}T23:59:59`);
    return {
      fechaDesde: d,
      fechaHasta: h,
      label: `${desde} al ${hasta}`,
    };
  }

  // default: mes actual
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return { fechaDesde: d, fechaHasta: now, label: "Este mes" };
}

export function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}
