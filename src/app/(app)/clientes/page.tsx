import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { ClientesLista } from "./clientes-lista";

export default async function ClientesPage() {
  await requireAdmin();

  const clientes = await prisma.cliente.findMany({
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    include: { _count: { select: { ventas: true } } },
  });

  return (
    <div className="w-full space-y-4">
      <ClientesLista clientes={clientes} />
    </div>
  );
}
