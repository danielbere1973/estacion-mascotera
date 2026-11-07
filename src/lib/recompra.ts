import type { TamanioMascota, TipoMascota, UnidadMedida } from "@prisma/client";

// Estimación de cuándo un cliente va a necesitar recomprar un producto, en tres niveles:
//  1. "historial":  el propio ritmo del cliente con ese producto (necesita 2+ compras en días distintos).
//  2. "promedio":   el ritmo mediano de los otros clientes que recompraron ese producto.
//  3. "aproximado": contenido del producto (kg) / consumo diario típico de las mascotas del cliente.
// El ritmo se mide en días por unidad, así que comprar 2 bolsas duplica la duración.

export type MetodoRecompra = "historial" | "promedio" | "aproximado";
export type RecompraEstimada = { fecha: string; metodo: MetodoRecompra; dias: number };

export type CompraRecompra = { clienteId: number; productoId: number; dia: string; cantidad: number };
export type ProductoRecompra = { nombre: string; unidadMedida: UnidadMedida; contenido: number };
export type MascotaRecompra = { tipo: TipoMascota; tamanio: TamanioMascota | null };

// Consumo diario típico de alimento seco, en gramos.
const GRAMOS_DIA_PERRO: Record<TamanioMascota, number> = {
  MINI: 80,
  PEQUENIO: 150,
  MEDIANO: 300,
  GRANDE: 450,
  GIGANTE: 650,
};
const GRAMOS_DIA_GATO = 60;

const DIA_MS = 24 * 60 * 60 * 1000;
const aMs = (dia: string) => new Date(`${dia}T12:00:00Z`).getTime();
const sumarDias = (dia: string, dias: number) => new Date(aMs(dia) + dias * DIA_MS).toISOString().slice(0, 10);

function mediana(valores: number[]) {
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Para qué especie es el producto, según el nombre (null = no se sabe, se usan todas las mascotas).
function especieProducto(nombre: string): TipoMascota | null {
  const n = nombre.toUpperCase();
  if (/\b(CAT|CATS|FELINE|FELINO|GATO|GATOS|KITTEN)\b/.test(n)) return "GATO";
  if (/\b(DOG|DOGS|CANINE|PERRO|PERROS|PUPPY|CACHORRO)\b/.test(n)) return "PERRO";
  return null;
}

function kgPorUnidad(p: ProductoRecompra) {
  if (p.unidadMedida === "KILOGRAMOS") return p.contenido;
  if (p.unidadMedida === "GRAMOS") return p.contenido / 1000;
  return null;
}

// Días que le dura una unidad del producto a las mascotas del cliente, o null si falta información.
function diasPorUnidadAproximado(producto: ProductoRecompra, mascotas: MascotaRecompra[]) {
  const kg = kgPorUnidad(producto);
  if (!kg || kg <= 0) return null;
  const especie = especieProducto(producto.nombre);
  const relevantes = especie ? mascotas.filter((m) => m.tipo === especie) : mascotas;
  if (relevantes.length === 0) return null;
  let gramosDia = 0;
  for (const m of relevantes) {
    if (m.tipo === "GATO") gramosDia += GRAMOS_DIA_GATO;
    else if (m.tamanio) gramosDia += GRAMOS_DIA_PERRO[m.tamanio];
    else return null; // perro sin tamaño cargado: no se puede estimar
  }
  return (kg * 1000) / gramosDia;
}

export function crearEstimadorRecompra(
  compras: CompraRecompra[],
  productos: Map<number, ProductoRecompra>,
  mascotasPorCliente: Map<number, MascotaRecompra[]>,
) {
  // Unidades por día de compra, por cliente y producto.
  const porPar = new Map<string, Map<string, number>>();
  for (const c of compras) {
    const key = `${c.clienteId}-${c.productoId}`;
    const dias = porPar.get(key) ?? new Map<string, number>();
    dias.set(c.dia, (dias.get(c.dia) ?? 0) + c.cantidad);
    porPar.set(key, dias);
  }

  // Ritmo (días por unidad) de cada par con 2+ compras: tiempo entre la primera y la última
  // compra, dividido por las unidades que se consumieron en ese lapso (todas menos la última compra).
  const ritmoPar = new Map<string, number>();
  const ritmosPorProducto = new Map<number, number[]>();
  for (const [key, dias] of porPar) {
    const orden = [...dias.keys()].sort();
    if (orden.length < 2) continue;
    const unidadesAntes = orden.slice(0, -1).reduce((a, d) => a + dias.get(d)!, 0);
    if (unidadesAntes <= 0) continue;
    const ritmo = (aMs(orden.at(-1)!) - aMs(orden[0])) / DIA_MS / unidadesAntes;
    ritmoPar.set(key, ritmo);
    const productoId = Number(key.split("-")[1]);
    ritmosPorProducto.set(productoId, [...(ritmosPorProducto.get(productoId) ?? []), ritmo]);
  }
  const ritmoProducto = new Map([...ritmosPorProducto].map(([id, r]) => [id, mediana(r)]));

  return function estimar(clienteId: number, productoId: number): RecompraEstimada | null {
    const key = `${clienteId}-${productoId}`;
    const dias = porPar.get(key);
    if (!dias) return null;
    const ultimoDia = [...dias.keys()].sort().at(-1)!;
    const unidadesUltima = dias.get(ultimoDia)!;

    let metodo: MetodoRecompra;
    let ritmo = ritmoPar.get(key);
    if (ritmo !== undefined) metodo = "historial";
    else if ((ritmo = ritmoProducto.get(productoId)) !== undefined) metodo = "promedio";
    else {
      const producto = productos.get(productoId);
      const aprox = producto ? diasPorUnidadAproximado(producto, mascotasPorCliente.get(clienteId) ?? []) : null;
      if (aprox === null) return null;
      ritmo = aprox;
      metodo = "aproximado";
    }

    const duracion = Math.max(1, Math.round(ritmo * unidadesUltima));
    return { fecha: sumarDias(ultimoDia, duracion), metodo, dias: duracion };
  };
}
