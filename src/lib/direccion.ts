// Arma la dirección de un cliente a partir de sus campos (calle, altura, piso, dpto, localidad, CP).

type DireccionCliente = {
  direccion: string;
  altura?: string | null;
  piso?: string | null;
  dpto?: string | null;
  localidad?: string | null;
  cp?: string | null;
};

// "Av. Rivadavia 1234, Piso 3 Dpto B, Caballito, CABA (CP 1406)"
export function direccionCompleta(c: DireccionCliente): string {
  const calle = [c.direccion, c.altura].filter(Boolean).join(" ");
  const depto = [c.piso && `Piso ${c.piso}`, c.dpto && `Dpto ${c.dpto}`].filter(Boolean).join(" ");
  const partes = [calle, depto, c.localidad].filter(Boolean).join(", ");
  return c.cp ? `${partes} (CP ${c.cp})` : partes;
}

// Para Waze: calle, altura y localidad (piso, dpto y CP solo confunden la búsqueda).
export function direccionParaMapa(c: DireccionCliente): string {
  return [[c.direccion, c.altura].filter(Boolean).join(" "), c.localidad].filter(Boolean).join(", ");
}

export function linkWaze(c: DireccionCliente): string {
  return `https://waze.com/ul?q=${encodeURIComponent(direccionParaMapa(c))}&navigate=yes`;
}
