import { prisma } from "@/lib/prisma";
import { NuevaConsignacionForm } from "./nueva-consignacion-form";

export default async function NuevaConsignacionPage() {
  const [socios, productos] = await Promise.all([
    prisma.socioConsignacion.findMany({ orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({
      select: { id: true, nombre: true, marca: true, stockActual: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Nueva consignación</h1>
      <NuevaConsignacionForm socios={socios} productos={productos} />
    </div>
  );
}
