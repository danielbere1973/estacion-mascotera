import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { ProveedoresLista } from "./proveedores-lista";

export default async function ProveedoresPage() {
  await requireAdmin();

  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      contacto: true,
      email: true,
      alias: true,
      cbu: true,
      direccion: true,
      accountManager: true,
      horarios: true,
    },
  });

  return (
    <div className="w-full space-y-4">
      <ProveedoresLista proveedores={proveedores} />
    </div>
  );
}
