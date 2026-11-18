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

type SegundaDireccionCliente = {
  direccion2?: string | null;
  altura2?: string | null;
  piso2?: string | null;
  dpto2?: string | null;
  localidad2?: string | null;
  cp2?: string | null;
};

// La segunda dirección con la misma forma que la primera (direccion queda "" si no tiene calle).
export function segundaDireccion(c: SegundaDireccionCliente): DireccionCliente {
  return {
    direccion: c.direccion2 ?? "",
    altura: c.altura2,
    piso: c.piso2,
    dpto: c.dpto2,
    localidad: c.localidad2,
    cp: c.cp2,
  };
}
