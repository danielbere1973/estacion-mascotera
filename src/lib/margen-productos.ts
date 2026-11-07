// Regla de margen por peso: alimentos balanceados de 10kg o más llevan un
// margen que depende del costo (ver margenAlimentoPorCosto), en vez del 30%
// estándar. Piedras sanitarias y productos de higiene (aunque pesen ≥10kg)
// quedan excluidos y mantienen el margen que tengan (40% fijo).
//
// Patrones confirmados manualmente contra el catálogo real (ver conversación
// de 2026-10-03): todo lo que menciona piedra/arena sanitaria para gatos o
// viruta sanitaria en el nombre.
const PATRONES_NO_ALIMENTO = [
  /piedra/i,
  /gattini/i,
  /konkatt/i,
  /bentonita/i,
  /bedywood/i,
  /sanitario/i,
  /absorsol/i,
];

export const MARGEN_ESTANDAR = 30;

export function esAlimentoPorNombre(nombre: string): boolean {
  return !PATRONES_NO_ALIMENTO.some((re) => re.test(nombre));
}

export function calificaParaMargenPorPeso(params: {
  nombre: string;
  unidadMedida: string;
  contenido: number;
}): boolean {
  return params.unidadMedida === "KILOGRAMOS" && params.contenido >= 10 && esAlimentoPorNombre(params.nombre);
}

// Tramos de margen para alimento ≥10kg, confirmados 2026-10-04: a mayor
// costo, menor margen porcentual (para no desalinear el precio final).
function margenAlimentoPorCosto(costo: number): number {
  if (costo >= 60000) return 20;
  if (costo >= 45000) return 25;
  return 30;
}

// Para productos nuevos (sin margen previo): si no califica por peso, usa el
// margen estándar. Para productos existentes con margen ya asignado (p.ej.
// piedras en 40%), usar calificaParaMargenPorPeso() como guard en vez de esta
// función, para no pisar ese margen con el estándar de 30%.
export function calcularMargenPorPeso(params: {
  nombre: string;
  unidadMedida: string;
  contenido: number;
  costo: number;
}): number {
  return calificaParaMargenPorPeso(params) ? margenAlimentoPorCosto(params.costo) : MARGEN_ESTANDAR;
}
