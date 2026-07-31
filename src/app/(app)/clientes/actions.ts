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
  const mascotas = formData.get("mascotas")?.toString().trim() || null;

  if (!nombre || !apellido || !direccion || !telefono) {
    throw new Error("Faltan datos obligatorios.");
  }

  await prisma.cliente.update({
    where: { id },
    data: { nombre, apellido, direccion, telefono, email, mascotas },
  });

  revalidatePath("/clientes");
  revalidatePath("/ventas");
  redirect("/clientes");
}

export async function agregarProductoRecurrente(formData: FormData) {
  await requireAdmin();

  const clienteId = Number(formData.get("clienteId"));
  const productoId = Number(formData.get("productoId"));
  const periodoDias = Number(formData.get("periodoDias"));
  const notas = formData.get("notas")?.toString().trim() || null;

  if (!clienteId || !productoId || !periodoDias) throw new Error("Datos inválidos.");

  await prisma.clienteProductoRecurrente.upsert({
    where: { clienteId_productoId: { clienteId, productoId } },
    update: { periodoDias, notas, activo: true },
    create: { clienteId, productoId, periodoDias, notas },
  });

  revalidatePath(`/clientes/${clienteId}/editar`);
  revalidatePath("/clientes/reposicion");
}

export async function editarProductoRecurrente(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));
  const periodoDias = Number(formData.get("periodoDias"));
  const notas = formData.get("notas")?.toString().trim() || null;
  const activo = formData.get("activo") !== "false";

  if (!id || !periodoDias) throw new Error("Datos inválidos.");

  const rec = await prisma.clienteProductoRecurrente.update({
    where: { id },
    data: { periodoDias, notas, activo },
  });

  revalidatePath(`/clientes/${rec.clienteId}/editar`);
  revalidatePath("/clientes/reposicion");
}

export async function eliminarProductoRecurrente(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Inválido.");

  const rec = await prisma.clienteProductoRecurrente.delete({ where: { id } });

  revalidatePath(`/clientes/${rec.clienteId}/editar`);
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
