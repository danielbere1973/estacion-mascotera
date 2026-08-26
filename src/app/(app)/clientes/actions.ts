"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { TipoMascota, TamanioMascota } from "@prisma/client";

export async function crearCliente(formData: FormData) {
  await requireAdmin();

  const nombre = formData.get("nombre")?.toString().trim();
  const apellido = formData.get("apellido")?.toString().trim();
  const direccion = formData.get("direccion")?.toString().trim();
  const telefono = formData.get("telefono")?.toString().trim();
  const email = formData.get("email")?.toString().trim() || null;
  const cuit = formData.get("cuit")?.toString().trim() || null;
  const dni = formData.get("dni")?.toString().trim() || null;

  if (!nombre || !apellido || !direccion || !telefono) {
    throw new Error("Faltan datos obligatorios.");
  }

  await prisma.cliente.create({
    data: { nombre, apellido, direccion, telefono, email, cuit, dni },
  });

  revalidatePath("/clientes");
  revalidatePath("/ventas");
}

export async function actualizarCliente(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Cliente inválido.");

  const nombre = formData.get("nombre")?.toString().trim();
  const apellido = formData.get("apellido")?.toString().trim();
  const direccion = formData.get("direccion")?.toString().trim();
  const telefono = formData.get("telefono")?.toString().trim();
  const email = formData.get("email")?.toString().trim() || null;
  const cuit = formData.get("cuit")?.toString().trim() || null;
  const dni = formData.get("dni")?.toString().trim() || null;

  if (!nombre || !apellido || !direccion || !telefono) {
    throw new Error("Faltan datos obligatorios.");
  }

  await prisma.cliente.update({
    where: { id },
    data: { nombre, apellido, direccion, telefono, email, cuit, dni },
  });

  revalidatePath("/clientes");
  revalidatePath("/ventas");
  redirect("/clientes");
}

export async function agregarMascota(formData: FormData) {
  await requireAdmin();

  const clienteId = Number(formData.get("clienteId"));
  const tipo = formData.get("tipo")?.toString() as TipoMascota;
  const nombre = formData.get("nombre")?.toString().trim();
  const edad = formData.get("edad")?.toString().trim();
  const tamanio = formData.get("tamanio")?.toString() as TamanioMascota;
  const raza = formData.get("raza")?.toString().trim() || null;
  const condicionesEspeciales = formData.get("condicionesEspeciales")?.toString().trim() || null;

  if (!clienteId || !tipo || !nombre || !edad || !tamanio) throw new Error("Faltan datos obligatorios.");

  await prisma.mascota.create({
    data: { clienteId, tipo, nombre, edad, tamanio, raza, condicionesEspeciales },
  });

  revalidatePath(`/clientes/${clienteId}/editar`);
}

export async function eliminarMascota(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Inválido.");

  const mascota = await prisma.mascota.delete({ where: { id } });

  revalidatePath(`/clientes/${mascota.clienteId}/editar`);
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
