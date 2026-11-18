import { prisma } from "@/lib/prisma";
import { perfilAcceso } from "@/lib/permissions";
import { ProveedoresLista } from "./proveedores-lista";

export default async function ProveedoresPage() {
  const { soloLectura } = await perfilAcceso(); // Solo lectura puede ver, sin botones de edición.

  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      contacto: true,
      email: true,
      cuit: true,
      alias: true,
      cbu: true,
      direccion: true,
      accountManager: true,
      horarios: true,
    },
  });

  return (
    <div className="w-full space-y-4">
      <ProveedoresLista proveedores={proveedores} soloLectura={soloLectura} />
    </div>
  );
}
