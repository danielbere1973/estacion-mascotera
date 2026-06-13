import { auth } from "@/auth";
import { Nav } from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <Nav
        userName={session?.user?.name ?? ""}
        isAdmin={session?.user?.rol === "ADMIN"}
        isRestringido={session?.user?.rol === "LECTOR_RESTRINGIDO"}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
