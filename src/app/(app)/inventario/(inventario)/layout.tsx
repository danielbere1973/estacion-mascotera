import { requireModulo, requireSinRestriccion } from "@/lib/permissions";

// Solo entra quien tiene la sección habilitada en su usuario. Con Restricción de
// acceso a Proveedores, de Inventario solo puede ver Compras.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModulo("INVENTARIO");
  await requireSinRestriccion("/inventario/compras");
  return children;
}
