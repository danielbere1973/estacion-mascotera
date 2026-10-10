import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { eliminarSocio } from "../actions";

export default async function SociosPage() {
  const socios = await prisma.socioConsignacion.findMany({
    include: { proveedor: { select: { nombre: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="w-full space-y-4">
      <div>
        <Link href="/consignaciones" className="text-xs text-gray-400 hover:text-gray-600">← Consignaciones</Link>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-gray-900">Socios comerciales</h1>
          <Link href="/consignaciones/socios/nuevo"
            className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 md:px-4">
            + Nuevo<span className="hidden md:inline"> socio</span>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {socios.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-sm text-gray-900">{s.nombre}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {s.contacto && <span className="mr-3 break-words">{s.contacto}</span>}
                {s.proveedor && <span className="inline-block text-blue-600">Proveedor: {s.proveedor.nombre}</span>}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href={`/consignaciones/socios/${s.id}/editar`}
                className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">
                Editar
              </Link>
              <form action={eliminarSocio}>
                <input type="hidden" name="id" value={s.id} />
                <ConfirmSubmitButton
                  confirmMessage={`¿Eliminar a ${s.nombre}?`}
                  className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                  Eliminar
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>
        ))}
        {socios.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">No hay socios cargados.</p>
        )}
      </div>
    </div>
  );
}
