// Regla de margen por peso: alimentos balanceados de 10kg o más llevan 20% de
// margen en vez del 30% estándar. Piedras sanitarias y productos de higiene
// (aunque pesen ≥10kg) quedan excluidos y mantienen el margen que tengan.
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

export const MARGEN_ALIMENTO_10KG_O_MAS = 20;
export const MARGEN_ESTANDAR = 30;

export function esAlimentoPorNombre(nombre: string): boolean {
  return !PATRONES_NO_ALIMENTO.some((re) => re.test(nombre));
}

export function calcularMargenPorPeso(params: {
  nombre: string;
  unidadMedida: string;
  contenido: number;
}): number {
  const califica = params.unidadMedida === "KILOGRAMOS" && params.contenido >= 10 && esAlimentoPorNombre(params.nombre);
  return califica ? MARGEN_ALIMENTO_10KG_O_MAS : MARGEN_ESTANDAR;
}
