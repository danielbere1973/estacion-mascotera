import { cache } from "react";
import { redirect } from "next/navigation";
import type { ModuloApp } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MODULOS_CON_RESTRICCION, normalizarModulos } from "@/lib/modulos";

// Rol, módulos y proveedores se leen de la base y no de la sesión: así, si a un
// usuario se le cambia un permiso o se lo desactiva, aplica al instante sin volver
// a iniciar sesión. `cache`: una sola consulta por pedido aunque la llamen el
// layout y la página.
const usuarioActual = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const usuario = await prisma.usuario.findUnique({
    where: { id: Number(session.user.id) },
    select: { activo: true, rol: true, modulos: true, proveedoresAcceso: { select: { id: true } } },
  });
  if (!usuario?.activo) return null;

  // Restricción de acceso a Proveedores: null = ve todos los proveedores.
  const proveedores = usuario.proveedoresAcceso.length
    ? usuario.proveedoresAcceso.map((p) => p.id)
    : null;
  let modulos = normalizarModulos(usuario.modulos);
  // Con restricción solo entra a las secciones que filtran por proveedor.
  if (proveedores) modulos = modulos.filter((m) => MODULOS_CON_RESTRICCION.includes(m));

  return {
    // Cualquier rol que no sea ADMIN (Solo lectura o el viejo Lector restringido) solo puede ver.
    esAdmin: usuario.rol === "ADMIN",
    modulos,
    proveedores,
  };
});

async function exigirModulo(modulo?: ModuloApp) {
  if (!modulo) return;
  const usuario = await usuarioActual();
  if (!usuario?.modulos.includes(modulo)) throw new Error("No tenés acceso a esta sección.");
}

// Para server actions que modifican datos: exige rol ADMIN y, si se indica, acceso al módulo.
export async function requireAdmin(modulo?: ModuloApp) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  if (!(await usuarioActual())?.esAdmin) throw new Error("Tu usuario es de solo lectura: no puede hacer cambios.");
  await exigirModulo(modulo);
  return session;
}

// Para server actions que cualquier usuario con la sección puede usar
// (ej.: compartir la ubicación en Logística).
export async function requireAuth(modulo?: ModuloApp) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  if (!(await usuarioActual())) throw new Error("No autenticado");
  await exigirModulo(modulo);
  return session;
}

// Lo que necesita una página para decidir qué mostrar:
// - soloLectura: oculta botones de crear, editar y borrar.
// - proveedores: ids a los que está restringido (null = sin restricción).
export async function perfilAcceso() {
  const usuario = await usuarioActual();
  return {
    soloLectura: !usuario?.esAdmin,
    proveedores: usuario ? usuario.proveedores : [],
  };
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

// Para layouts de subpáginas que no filtran por proveedor (detalle, alta, edición):
// un usuario con Restricción de acceso a Proveedores vuelve a `destino`.
export async function requireSinRestriccion(destino: string) {
  if ((await perfilAcceso()).proveedores) redirect(destino);
}
