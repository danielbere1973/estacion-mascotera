"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { registrarLog } from "@/lib/log";
import { RolUsuario } from "@prisma/client";

export async function crearUsuario(formData: FormData) {
  const session = await requireAdmin();

  const nombre = formData.get("nombre")?.toString().trim();
  const apellido = formData.get("apellido")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const rol = formData.get("rol")?.toString() as RolUsuario;
  const proveedorRestrictoIdStr = formData.get("proveedorRestrictoId")?.toString();
  const activo = formData.get("activo") === "on";

  if (!nombre || !apellido || !email || !password) {
    throw new Error("Faltan datos del usuario.");
  }
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  if (rol !== "ADMIN" && rol !== "LECTOR_RESTRINGIDO") throw new Error("Rol inválido.");

  const proveedorRestrictoId =
    rol === "LECTOR_RESTRINGIDO" && proveedorRestrictoIdStr ? Number(proveedorRestrictoIdStr) : null;

  if (rol === "LECTOR_RESTRINGIDO" && !proveedorRestrictoId) {
    throw new Error("Seleccioná el proveedor al que queda restringido este usuario.");
  }

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
        proveedorRestrictoId,
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
  const proveedorRestrictoIdStr = formData.get("proveedorRestrictoId")?.toString();
  const activo = formData.get("activo") === "on";

  if (!nombre || !apellido || !email) throw new Error("Faltan datos del usuario.");
  if (rol !== "ADMIN" && rol !== "LECTOR_RESTRINGIDO") throw new Error("Rol inválido.");

  const proveedorRestrictoId =
    rol === "LECTOR_RESTRINGIDO" && proveedorRestrictoIdStr ? Number(proveedorRestrictoIdStr) : null;

  if (rol === "LECTOR_RESTRINGIDO" && !proveedorRestrictoId) {
    throw new Error("Seleccioná el proveedor al que queda restringido este usuario.");
  }

  const data: Parameters<typeof prisma.usuario.update>[0]["data"] = {
    nombre,
    apellido,
    email,
    rol,
    activo,
    proveedorRestrictoId,
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
