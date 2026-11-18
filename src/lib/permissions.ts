import { cache } from "react";
import { redirect } from "next/navigation";
import type { ModuloApp } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Los módulos se leen de la base y no de la sesión: así, si a un usuario se le
// quita una sección o se lo desactiva, la pierde al instante sin volver a iniciar sesión.
// `cache`: una sola consulta por pedido aunque la llamen el layout y la página.
const usuarioActual = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const usuario = await prisma.usuario.findUnique({
    where: { id: Number(session.user.id) },
    select: { activo: true, modulos: true },
  });
  return usuario?.activo ? usuario : null;
});

async function exigirModulo(modulo?: ModuloApp) {
  if (!modulo) return;
  const usuario = await usuarioActual();
  if (!usuario?.modulos.includes(modulo)) throw new Error("No tenés acceso a esta sección.");
}

// Para server actions: exige rol ADMIN y, si se indica, acceso al módulo.
export async function requireAdmin(modulo?: ModuloApp) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  if (session.user.rol !== "ADMIN") throw new Error("No tenés permisos para esta acción.");
  await exigirModulo(modulo);
  return session;
}

// Para server actions: exige sesión y, si se indica, acceso al módulo.
export async function requireAuth(modulo?: ModuloApp) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  await exigirModulo(modulo);
  return session;
}

// Módulos que el usuario logueado puede ver.
export async function modulosPermitidos(): Promise<ModuloApp[]> {
  return (await usuarioActual())?.modulos ?? [];
}

export async function puedeVer(modulo: ModuloApp) {
  return (await modulosPermitidos()).includes(modulo);
}

// Para layouts/páginas de cada módulo: si no lo tiene habilitado vuelve al inicio,
// que lo manda al primer módulo que sí puede ver.
export async function requireModulo(modulo: ModuloApp) {
  if (!(await puedeVer(modulo))) redirect("/");
}
