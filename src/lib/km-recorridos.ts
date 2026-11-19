// Cálculo de km recorridos mientras se comparte la ubicación en Logística.
//
// El celular manda la posición cada 10 segundos. Con el celular quieto el GPS "tiembla" unos
// metros, así que no se suma cada salto: se guarda un punto de referencia (el último contado) y
// recién cuando la posición nueva se aleja lo suficiente se suma esa distancia y se mueve el punto.
// Así tampoco se pierden los avances lentos (ej. tránsito), que se van acumulando.

// Lecturas con precisión peor que esta (en metros) no se cuentan: suelen ser saltos de antena.
export const PRECISION_MAXIMA_M = 50;
// Movimiento mínimo desde el último punto contado para sumarlo.
export const DISTANCIA_MINIMA_M = 25;
// Velocidad imposible para un reparto: el salto se descarta como error del GPS.
export const VELOCIDAD_MAXIMA_KMH = 150;

// Distancia en metros entre dos coordenadas (fórmula de haversine).
export function distanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type PuntoContado = { kmLatitud: number | null; kmLongitud: number | null; kmAt: Date | null; kmRecorridos: number };
type Lectura = { latitud: number; longitud: number; precision: number | null };

// Devuelve los campos a guardar si la lectura suma km (y mueve el punto de referencia), o null si no.
export function sumarKm(actual: PuntoContado, lectura: Lectura, ahora: Date) {
  if (lectura.precision != null && lectura.precision > PRECISION_MAXIMA_M) return null;

  // Primer punto válido: queda como referencia, todavía no suma.
  if (actual.kmLatitud == null || actual.kmLongitud == null || !actual.kmAt) {
    return { kmLatitud: lectura.latitud, kmLongitud: lectura.longitud, kmAt: ahora, kmRecorridos: actual.kmRecorridos };
  }

  const metros = distanciaMetros(actual.kmLatitud, actual.kmLongitud, lectura.latitud, lectura.longitud);
  // El umbral crece con la imprecisión de la lectura (si el GPS dice ±40 m, moverse 30 m no es seguro).
  if (metros < Math.max(DISTANCIA_MINIMA_M, lectura.precision ?? 0)) return null;

  const horas = (ahora.getTime() - actual.kmAt.getTime()) / 3_600_000;
  if (horas > 0 && metros / 1000 / horas > VELOCIDAD_MAXIMA_KMH) return null;

  return {
    kmLatitud: lectura.latitud,
    kmLongitud: lectura.longitud,
    kmAt: ahora,
    kmRecorridos: actual.kmRecorridos + metros / 1000,
  };
}

// "3,4 km" (o "350 m" si no llega a 1 km).
export function formatoKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}
