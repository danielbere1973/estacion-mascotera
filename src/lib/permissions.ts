import { auth } from "@/auth";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  if (session.user.rol !== "ADMIN") throw new Error("No tenés permisos para esta acción.");
  return session;
}
