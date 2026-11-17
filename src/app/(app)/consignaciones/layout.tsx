import { requireModulo } from "@/lib/permissions";

// Solo entra quien tiene la sección habilitada en su usuario.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModulo("CONSIGNACIONES");
  return children;
}
