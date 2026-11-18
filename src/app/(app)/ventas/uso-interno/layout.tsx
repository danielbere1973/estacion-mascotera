import { requireEdicion, requireSinRestriccion } from "@/lib/permissions";

// Página de alta: no filtra por proveedor y no la usa un usuario Solo lectura;
// en esos casos vuelve al listado.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireSinRestriccion("/ventas");
  await requireEdicion("/ventas");
  return children;
}
