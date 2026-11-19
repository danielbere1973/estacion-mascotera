import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Filtros del listado de Ventas (los mismos para la pantalla y para Exportar).
export type ParamsFiltroVentas = {
  desde?: string;
  hasta?: string;
  clienteId?: string;
  facturado?: string;
  canal?: string[];
  pago?: string[];
};

// Lee los filtros de la URL (canal y pago pueden venir repetidos).
export function leerFiltroVentas(get: (k: string) => string | null, getAll: (k: string) => string[]): ParamsFiltroVentas {
  return {
    desde: get("desde") ?? undefined,
    hasta: get("hasta") ?? undefined,
    clienteId: get("clienteId") ?? undefined,
    facturado: get("facturado") ?? undefined,
    canal: getAll("canal"),
    pago: getAll("pago"),
  };
}

// Arma el `where` de Prisma. `proveedores`: restricción de acceso del usuario (null = sin restricción):
// solo ve las ventas con productos que le compró a esos proveedores.
export async function armarFiltroVentas(
  params: ParamsFiltroVentas,
  proveedores: number[] | null
): Promise<Prisma.VentaWhereInput> {
  const where: Prisma.VentaWhereInput = {};

  if (params.desde || params.hasta) {
    where.fechaVenta = {
      ...(params.desde ? { gte: new Date(params.desde) } : {}),
      ...(params.hasta ? { lt: new Date(`${params.hasta}T23:59:59`) } : {}),
    };
  }

  if (params.clienteId) where.clienteId = Number(params.clienteId);
  if (params.facturado === "si") where.facturado = true;
  if (params.facturado === "no") where.facturado = false;
  if (params.canal?.length) where.canalVenta = { in: params.canal as Prisma.EnumCanalVentaFilter["in"] };
  if (params.pago?.length) where.medioPago = { in: params.pago };

  if (proveedores) {
    const comprasDelProveedor = await prisma.compra.findMany({
      where: { proveedorId: { in: proveedores } },
      select: { productoId: true },
      distinct: ["productoId"],
    });
    const productoIds = comprasDelProveedor.map((c) => c.productoId);
    where.detalles = { some: { productoId: { in: productoIds } } };
  }

  return where;
}
