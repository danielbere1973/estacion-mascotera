export type PeriodoKey = "mes" | "mes-anterior" | "anio" | "todo";

export const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: "mes", label: "Este mes" },
  { key: "mes-anterior", label: "Mes anterior" },
  { key: "anio", label: "Este año" },
  { key: "todo", label: "Todo" },
];

export function getRangoFechas(periodo: PeriodoKey): { desde?: Date; hasta?: Date } {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth();

  switch (periodo) {
    case "mes":
      return { desde: new Date(anio, mes, 1), hasta: new Date(anio, mes + 1, 1) };
    case "mes-anterior":
      return { desde: new Date(anio, mes - 1, 1), hasta: new Date(anio, mes, 1) };
    case "anio":
      return { desde: new Date(anio, 0, 1), hasta: new Date(anio + 1, 0, 1) };
    case "todo":
    default:
      return {};
  }
}

export function parsePeriodo(value: string | undefined): PeriodoKey {
  if (value === "mes-anterior" || value === "anio" || value === "todo") return value;
  return "mes";
}
