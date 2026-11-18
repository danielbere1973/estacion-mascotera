import { requireSinRestriccion } from "@/lib/permissions";

// Esta página no filtra por proveedor: un usuario con Restricción de acceso a
// Proveedores vuelve al listado.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireSinRestriccion("/ventas");
  return children;
}
