import { TipoProductoMayorista, UnidadMedida } from "@prisma/client";

type ProductoParaMargen = {
  tipoProductoMayorista: TipoProductoMayorista | null;
  contenido: number | string;
  unidadMedida: UnidadMedida;
};

type MargenConfig = {
  tipoProducto: TipoProductoMayorista;
  margenPorcentaje: number | string;
  margenPorcentajeTramo2: number | string | null;
  umbralKgTramo2: number | string | null;
};

function contenidoEnKg(contenido: number | string, unidadMedida: UnidadMedida): number | null {
  const valor = Number(contenido);
  if (unidadMedida === "KILOGRAMOS") return valor;
  if (unidadMedida === "GRAMOS") return valor / 1000;
  // Litros/mililitros/unidad no son peso: no aplica el tramo por kg.
  return null;
}

// Margen mayorista (%) a aplicar sobre el costo para un producto dado.
// En ALIMENTO_SECO el margen depende del peso: bolsas grandes (>= umbralKgTramo2)
// usan margenPorcentajeTramo2 en vez del margen base.
export function margenMayoristaDe(producto: ProductoParaMargen, margenes: MargenConfig[]): number | null {
  if (!producto.tipoProductoMayorista) return null;
  const config = margenes.find((m) => m.tipoProducto === producto.tipoProductoMayorista);
  if (!config) return null;

  const base = Number(config.margenPorcentaje);
  if (config.margenPorcentajeTramo2 == null || config.umbralKgTramo2 == null) return base;

  const kg = contenidoEnKg(producto.contenido, producto.unidadMedida);
  if (kg == null) return base;

  return kg >= Number(config.umbralKgTramo2) ? Number(config.margenPorcentajeTramo2) : base;
}

export function precioMayoristaDe(
  producto: ProductoParaMargen & { precioCostoUnitario: number | string },
  margenes: MargenConfig[]
): number | null {
  const margen = margenMayoristaDe(producto, margenes);
  if (margen == null) return null;
  return Number(producto.precioCostoUnitario) * (1 + margen / 100);
}
