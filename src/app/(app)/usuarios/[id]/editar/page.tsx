import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { actualizarUsuario } from "../../actions";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.rol !== "ADMIN") redirect("/");

  const { id } = await params;

  const [usuario, proveedores] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: Number(id) } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  if (!usuario) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Editar usuario</h1>

      <form
        action={actualizarUsuario}
        className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={usuario.id} />

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Nombre</label>
          <input
            name="nombre"
            required
            defaultValue={usuario.nombre}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Apellido</label>
          <input
            name="apellido"
            required
            defaultValue={usuario.apellido}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            name="email"
            required
            defaultValue={usuario.email}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium text-gray-700">
            Nueva contraseña (dejar vacío para no cambiarla)
          </label>
          <input
            type="password"
            name="password"
            minLength={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Rol</label>
          <select
            name="rol"
            defaultValue={usuario.rol}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="ADMIN">Administrador (acceso total)</option>
            <option value="LECTOR_RESTRINGIDO">Lector restringido a un proveedor</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Proveedor (solo para Lector restringido)
          </label>
          <select
            name="proveedorRestrictoId"
            defaultValue={usuario.proveedorRestrictoId ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Sin restricción</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" name="activo" defaultChecked={usuario.activo} className="h-4 w-4" />
            Usuario activo
          </label>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
