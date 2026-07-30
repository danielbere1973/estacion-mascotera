"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function actualizarCliente(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Cliente inválido.");

  const nombre = formData.get("nombre")?.toString().trim();
  const apellido = formData.get("apellido")?.toString().trim();
  const direccion = formData.get("direccion")?.toString().trim();
  const telefono = formData.get("telefono")?.toString().trim();
  const email = formData.get("email")?.toString().trim() || null;
  const esRecurrente = formData.get("esRecurrente") === "on";
  const periodoReposicionDiasStr = formData.get("periodoReposicionDias")?.toString().trim();
  const periodoReposicionDias = periodoReposicionDiasStr ? Number(periodoReposicionDiasStr) : null;
  const notasReposicion = formData.get("notasReposicion")?.toString().trim() || null;

  if (!nombre || !apellido || !direccion || !telefono) {
    throw new Error("Faltan datos obligatorios.");
  }

  await prisma.cliente.update({
    where: { id },
    data: { nombre, apellido, direccion, telefono, email, esRecurrente, periodoReposicionDias, notasReposicion },
  });

  revalidatePath("/clientes");
  revalidatePath("/ventas");
  redirect("/clientes");
}

// Genera o actualiza recordatorios para todos los clientes recurrentes,
// basándose en el historial real de ventas por producto.
export async function generarRecordatorios() {
  const clientes = await prisma.cliente.findMany({
    where: { esRecurrente: true },
  });

  for (const cliente of clientes) {
    // Obtener todas las ventas del cliente, agrupadas por producto
    const detalles = await prisma.detalleVenta.findMany({
      where: { venta: { clienteId: cliente.id } },
      include: {
        venta: { select: { fechaVenta: true } },
        producto: { select: { id: true, nombre: true } },
      },
      orderBy: { venta: { fechaVenta: "asc" } },
    });

    // Agrupar por producto
    const porProducto = new Map<number, { productoId: number; nombreProducto: string; fechas: Date[] }>();
    for (const d of detalles) {
      if (!d.productoId) continue;
      const entry = porProducto.get(d.productoId) ?? { productoId: d.productoId, nombreProducto: d.producto?.nombre ?? "", fechas: [] };
      entry.fechas.push(d.venta.fechaVenta);
      porProducto.set(d.productoId, entry);
    }

    for (const { productoId, nombreProducto, fechas } of porProducto.values()) {
      if (fechas.length < 1) continue;

      const ultimaCompra = fechas[fechas.length - 1];

      // Calcular período: promedio de días entre compras, o usar el período manual del cliente
      let periodoDias = cliente.periodoReposicionDias;
      if (!periodoDias && fechas.length >= 2) {
        const intervalos: number[] = [];
        for (let i = 1; i < fechas.length; i++) {
          const dias = Math.round((fechas[i].getTime() - fechas[i - 1].getTime()) / (1000 * 60 * 60 * 24));
          if (dias > 0) intervalos.push(dias);
        }
        if (intervalos.length > 0) {
          periodoDias = Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length);
        }
      }

      if (!periodoDias) continue; // sin período calculable todavía

      const fechaEstimada = new Date(ultimaCompra);
      fechaEstimada.setDate(fechaEstimada.getDate() + periodoDias);

      const mensaje = `Hola ${cliente.nombre}! Te recordamos que el ${ultimaCompra.toLocaleDateString("es-AR")} compraste ${nombreProducto}. Si ya se te está terminando, avisanos y te lo preparamos. ¡Saludos!`;

      // Upsert: un recordatorio por cliente+producto no enviado
      const existente = await prisma.recordatorioReposicion.findFirst({
        where: { clienteId: cliente.id, productoId, enviado: false },
      });

      if (existente) {
        await prisma.recordatorioReposicion.update({
          where: { id: existente.id },
          data: { fechaUltimaCompra: ultimaCompra, fechaEstimadaReposicion: fechaEstimada, mensaje },
        });
      } else {
        await prisma.recordatorioReposicion.create({
          data: { clienteId: cliente.id, productoId, fechaUltimaCompra: ultimaCompra, fechaEstimadaReposicion: fechaEstimada, mensaje },
        });
      }
    }
  }

  revalidatePath("/clientes/reposicion");
}

export async function marcarEnviado(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Recordatorio inválido.");

  await prisma.recordatorioReposicion.update({
    where: { id },
    data: { enviado: true, fechaEnvio: new Date() },
  });

  revalidatePath("/clientes/reposicion");
}
