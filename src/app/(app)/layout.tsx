import { auth } from "@/auth";
import { Sidebar, TopBar } from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAdmin = session?.user?.rol === "ADMIN";
  const isRestringido = session?.user?.rol === "LECTOR_RESTRINGIDO";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isAdmin={isAdmin} isRestringido={isRestringido} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar userName={session?.user?.name ?? ""} />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
