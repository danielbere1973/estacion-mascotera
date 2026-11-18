import { prisma } from "@/lib/prisma";
import { perfilAcceso } from "@/lib/permissions";
import { ClientesLista } from "./clientes-lista";

export default async function ClientesPage() {
  const { soloLectura } = await perfilAcceso(); // Solo lectura puede ver, sin botones de edición.

  const clientes = await prisma.cliente.findMany({
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    include: { _count: { select: { ventas: true } } },
  });

  return (
    <div className="w-full space-y-4">
      <ClientesLista clientes={clientes} soloLectura={soloLectura} />
    </div>
  );
}
