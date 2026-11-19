import { redirect } from "next/navigation";
import { perfilAcceso } from "@/lib/permissions";

// Mayorista > Carritos: solo usuarios Administrador.
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await perfilAcceso()).esAdmin) redirect("/");
  return children;
}
