import { requireModulo } from "@/lib/permissions";

// Solo entra quien tiene esta sección de Mayorista habilitada en su usuario.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModulo("MAYORISTA_TIPO");
  return children;
}
