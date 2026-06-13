export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const UNIDAD_MEDIDA_LABELS: Record<string, string> = {
  KILOGRAMOS: "Kg",
  GRAMOS: "g",
  LITROS: "L",
  MILILITROS: "ml",
  UNIDAD: "un.",
};

export function formatContenido(contenido: number | string, unidadMedida: string): string {
  const numero = typeof contenido === "string" ? Number(contenido) : contenido;
  const valor = Number.isInteger(numero) ? numero : numero.toFixed(2);
  return `${valor} ${UNIDAD_MEDIDA_LABELS[unidadMedida] ?? unidadMedida}`;
}
