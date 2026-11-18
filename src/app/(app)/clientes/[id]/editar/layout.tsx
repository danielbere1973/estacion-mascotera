import { requireEdicion } from "@/lib/permissions";

// Página de alta/edición: un usuario Solo lectura vuelve al listado.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireEdicion("/clientes");
  return children;
}
