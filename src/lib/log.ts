import { prisma } from "@/lib/prisma";
import { AccionLog, EntidadLog, Prisma } from "@prisma/client";

export async function registrarLog(
  db: Prisma.TransactionClient | typeof prisma,
  params: {
    usuarioId: number;
    accion: AccionLog;
    entidad: EntidadLog;
    entidadId?: number | null;
    detalle?: string | null;
  }
) {
  await db.logActividad.create({
    data: {
      usuarioId: params.usuarioId,
      accion: params.accion,
      entidad: params.entidad,
      entidadId: params.entidadId ?? null,
      detalle: params.detalle ?? null,
    },
  });
}
