import { Prisma } from "@prisma/client";

export type DatosClienteExterno = {
  nombre: string;
  apellido?: string;
  direccion?: string;
  telefono?: string | null;
  email?: string | null;
  dni?: string | null;
};

export async function buscarOCrearCliente(
  tx: Prisma.TransactionClient,
  datos: DatosClienteExterno
): Promise<{ clienteId: number; creado: boolean }> {
  const condiciones: Prisma.ClienteWhereInput[] = [];
  if (datos.email) condiciones.push({ email: datos.email });
  if (datos.telefono) condiciones.push({ telefono: datos.telefono });
  if (datos.dni) condiciones.push({ dni: datos.dni });

  if (condiciones.length > 0) {
    const existente = await tx.cliente.findFirst({ where: { OR: condiciones } });
    if (existente) return { clienteId: existente.id, creado: false };
  }

  const creado = await tx.cliente.create({
    data: {
      nombre: datos.nombre,
      apellido: datos.apellido || "-",
      direccion: datos.direccion || "Sin dirección (Tiendanube)",
      telefono: datos.telefono || "Sin teléfono (Tiendanube)",
      email: datos.email || null,
      dni: datos.dni || null,
    },
  });

  return { clienteId: creado.id, creado: true };
}
