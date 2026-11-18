import { auth } from "@/auth";
import { AppShell } from "@/components/nav";
import { modulosPermitidos } from "@/lib/permissions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAdmin = session?.user?.rol === "ADMIN";
  const isRestringido = session?.user?.rol === "LECTOR_RESTRINGIDO";
  const modulos = await modulosPermitidos();

  return (
    <AppShell isAdmin={isAdmin} isRestringido={isRestringido} modulos={modulos} userName={session?.user?.name ?? ""}>
      {children}
    </AppShell>
  );
}
