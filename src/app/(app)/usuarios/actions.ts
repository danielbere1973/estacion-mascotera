"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { registrarLog } from "@/lib/log";
import { RolUsuario } from "@prisma/client";
import { modulosDelFormulario } from "@/lib/modulos";

// Cliente mayorista vinculado (vacío = ninguno).
function clienteDelFormulario(formData: FormData): number | null {
  const id = Number(formData.get("clienteId"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Proveedores tildados en "Restricción de acceso a Proveedores" (vacío = sin restricción).
function proveedoresDelFormulario(formData: FormData): number[] {
  return formData
    .getAll("proveedores")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
}

export async function crearUsuario(formData: FormData) {
  const session = await requireAdmin();

  const nombre = formData.get("nombre")?.toString().trim();
  const apellido = formData.get("apellido")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const rol = formData.get("rol")?.toString() as RolUsuario;
  const proveedores = proveedoresDelFormulario(formData);
  const clienteId = clienteDelFormulario(formData);
  const activo = formData.get("activo") === "on";
  const modulos = modulosDelFormulario(formData);

  if (!nombre || !apellido || !email || !password) {
    throw new Error("Faltan datos del usuario.");
  }
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  if (rol !== "ADMIN" && rol !== "SOLO_LECTURA") throw new Error("Rol inválido.");


  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        nombre,
        apellido,
        email,
        passwordHash,
        rol,
        activo,
        modulos,
        clienteId,
        proveedoresAcceso: { connect: proveedores.map((id) => ({ id })) },
      },
    });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "CREAR",
      entidad: "USUARIO",
      entidadId: usuario.id,
      detalle: `${nombre} ${apellido} (${email})`,
    });
  });

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function actualizarUsuario(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Usuario inválido.");

  const nombre = formData.get("nombre")?.toString().trim();
  const apellido = formData.get("apellido")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const rol = formData.get("rol")?.toString() as RolUsuario;
  const proveedores = proveedoresDelFormulario(formData);
  const clienteId = clienteDelFormulario(formData);
  const activo = formData.get("activo") === "on";
  const modulos = modulosDelFormulario(formData);

  if (!nombre || !apellido || !email) throw new Error("Faltan datos del usuario.");
  if (rol !== "ADMIN" && rol !== "SOLO_LECTURA") throw new Error("Rol inválido.");


  const data: Parameters<typeof prisma.usuario.update>[0]["data"] = {
    nombre,
    apellido,
    email,
    rol,
    activo,
    modulos,
    clienteId,
    proveedoresAcceso: { set: proveedores.map((id) => ({ id })) },
    // Campo viejo de cuando la restricción era un solo proveedor: se limpia al guardar.
    proveedorRestrictoId: null,
  };

  if (password) {
    if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id }, data });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "ACTUALIZAR",
      entidad: "USUARIO",
      entidadId: id,
      detalle: `${nombre} ${apellido} (${email})`,
    });
  });

  revalidatePath("/usuarios");
  redirect("/usuarios");
}
