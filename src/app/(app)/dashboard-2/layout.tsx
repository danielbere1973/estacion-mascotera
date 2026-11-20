import { redirect } from "next/navigation";
import { perfilAcceso } from "@/lib/permissions";

// Dashboard 2: solo administradores (no es una sección habilitable por usuario).
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await perfilAcceso()).esAdmin) redirect("/");
  return children;
}
