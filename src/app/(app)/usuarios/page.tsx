import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { crearUsuario } from "./actions";

const ROL_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  LECTOR_RESTRINGIDO: "Lector restringido",
};

export default async function UsuariosPage() {
  const session = await auth();
  if (session?.user?.rol !== "ADMIN") redirect("/");

  const [usuarios, proveedores] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: { nombre: "asc" },
      include: { proveedorRestricto: { select: { nombre: true } } },
    }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>

      <details className="rounded-xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          + Nuevo usuario
        </summary>
        <form
          action={crearUsuario}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <input
              name="nombre"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Apellido</label>
            <input
              name="apellido"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Contraseña</label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Rol</label>
            <select
              name="rol"
              defaultValue="ADMIN"
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
              defaultValue=""
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
              <input type="checkbox" name="activo" defaultChecked className="h-4 w-4" />
              Usuario activo
            </label>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
            >
              Crear usuario
            </button>
          </div>
        </form>
      </details>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Restringido a</th>
              <th className="px-3 py-2">Activo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2">{u.nombre} {u.apellido}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">{u.email}</td>
                <td className="whitespace-nowrap px-3 py-2">{ROL_LABELS[u.rol]}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                  {u.proveedorRestricto?.nombre ?? "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {u.activo ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Sí</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">No</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <Link
                    href={`/usuarios/${u.id}/editar`}
                    className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
