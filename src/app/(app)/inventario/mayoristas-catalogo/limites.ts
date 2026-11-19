// Máximo de unidades por producto en el carrito mayorista, según el estado de stock del proveedor.
export const MAXIMO_POR_ESTADO = {
  "Stock disponible": 6,
  "Poco Stock": 2,
} as const;

export type EstadoStockCatalogo = keyof typeof MAXIMO_POR_ESTADO;

// Mismo criterio que muestra el catálogo: si algún proveedor tiene "Stock disponible" vale ese;
// si no, "Poco Stock" si alguno lo tiene; si no, el producto no se puede pedir (null).
export function estadoStockDe(estados: (string | null)[]): EstadoStockCatalogo | null {
  if (estados.includes("Stock disponible")) return "Stock disponible";
  if (estados.includes("Poco Stock")) return "Poco Stock";
  return null;
}

export function maximoPorEstado(estado: EstadoStockCatalogo | null): number {
  return estado ? MAXIMO_POR_ESTADO[estado] : 0;
}
