import { requireModulo } from "@/lib/permissions";

// Compras está fuera del grupo (inventario): es la única parte de Inventario
// que filtra por proveedor, así que la ve también un usuario con restricción.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModulo("INVENTARIO");
  return children;
}
