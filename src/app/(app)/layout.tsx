import { auth } from "@/auth";
import { AppShell } from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAdmin = session?.user?.rol === "ADMIN";
  const isRestringido = session?.user?.rol === "LECTOR_RESTRINGIDO";

  return (
    <AppShell isAdmin={isAdmin} isRestringido={isRestringido} userName={session?.user?.name ?? ""}>
      {children}
    </AppShell>
  );
}
