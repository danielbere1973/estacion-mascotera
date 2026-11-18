import { prisma } from "@/lib/prisma";
import { perfilAcceso, requireModulo } from "@/lib/permissions";
import { PromoForm } from "./promo-form";

export default async function MarketingPage() {
  await requireModulo("MARKETING");
  // Esta página es solo para crear campañas: Solo lectura ve un aviso.
  if ((await perfilAcceso()).soloLectura) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-gray-900">Marketing — Crear campaña</h1>
        <p className="text-sm text-gray-500">Tu usuario es de solo lectura: no puede crear ni enviar campañas.</p>
      </div>
    );
  }

  const clientes = await prisma.cliente.findMany({
    orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
    select: { id: true, nombre: true, apellido: true, email: true },
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-900">Marketing — Crear campaña</h1>
      <PromoForm clientes={clientes} />
    </div>
  );
}
