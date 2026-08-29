import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { PromoForm } from "./promo-form";

export default async function MarketingPage() {
  await requireAdmin();

  const clientes = await prisma.cliente.findMany({
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, apellido: true, email: true },
  });

  return (
    <div className="w-full space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Marketing — Crear campaña</h1>
      <PromoForm clientes={clientes} />
    </div>
  );
}
