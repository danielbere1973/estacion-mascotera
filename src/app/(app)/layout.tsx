import { auth } from "@/auth";
import { AppShell } from "@/components/nav";
import { modulosPermitidos, perfilAcceso } from "@/lib/permissions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // Con Restricción de acceso a Proveedores el menú muestra Compras en lugar de Inventario.
  const [modulos, { soloLectura, proveedores }] = await Promise.all([modulosPermitidos(), perfilAcceso()]);
  const isAdmin = !soloLectura;
  const isRestringido = proveedores !== null;

  return (
    <AppShell isAdmin={isAdmin} isRestringido={isRestringido} modulos={modulos} userName={session?.user?.name ?? ""}>
      {children}
    </AppShell>
  );
}
