import { prisma } from "@/lib/prisma";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { crearMedioPago, toggleMedioPago, eliminarMedioPago } from "./actions";

export default async function MediosPagoPage() {
  const medios = await prisma.medioPago.findMany({ orderBy: { nombre: "asc" } });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Medios de pago</h1>

      {/* Formulario nuevo */}
      <form action={crearMedioPago} className="flex gap-2">
        <input
          name="nombre"
          required
          placeholder="Ej: Débito"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Agregar
        </button>
      </form>

      {/* Lista */}
      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {medios.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <span className={`text-sm font-medium ${m.activo ? "text-gray-900" : "text-gray-400 line-through"}`}>
              {m.nombre}
            </span>
            <div className="flex items-center gap-2">
              <form action={toggleMedioPago}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="activo" value={String(m.activo)} />
                <button
                  type="submit"
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    m.activo
                      ? "text-yellow-700 hover:bg-yellow-50"
                      : "text-green-700 hover:bg-green-50"
                  }`}
                >
                  {m.activo ? "Desactivar" : "Activar"}
                </button>
              </form>
              <form action={eliminarMedioPago}>
                <input type="hidden" name="id" value={m.id} />
                <ConfirmSubmitButton
                  confirmMessage={`¿Eliminar "${m.nombre}"?`}
                  className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Eliminar
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>
        ))}
        {medios.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            No hay medios de pago configurados.
          </p>
        )}
      </div>
    </div>
  );
}
