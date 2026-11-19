import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { perfilAcceso } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { actualizarUsuario } from "../../actions";
import { ModulosCampo } from "../../modulos-campo";
import { ProveedoresCampo } from "../../proveedores-campo";
import { ClienteCampo } from "../../cliente-campo";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if ((await perfilAcceso()).soloLectura) redirect("/");

  const { id } = await params;

  const [usuario, proveedores, clientes] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: Number(id) },
      include: { proveedoresAcceso: { select: { id: true } } },
    }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.cliente.findMany({
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, apellido: true, dni: true },
    }),
  ]);

  if (!usuario) notFound();

  const opcionesClientes = clientes.map((c) => ({
    value: String(c.id),
    label: `${c.apellido}, ${c.nombre}`,
    search: `${c.nombre} ${c.apellido} ${c.dni ?? ""}`,
    hint: c.dni ? `DNI ${c.dni}` : undefined,
  }));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/usuarios" className="text-xs text-gray-400 hover:text-gray-600">← Usuarios</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Editar usuario</h1>
      </div>

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
            defaultValue={usuario.rol === "ADMIN" ? "ADMIN" : "SOLO_LECTURA"}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="ADMIN">Administrador (puede ver y modificar)</option>
            <option value="SOLO_LECTURA">Solo lectura (puede ver, no modificar)</option>
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" name="activo" defaultChecked={usuario.activo} className="h-4 w-4" />
            Usuario activo
          </label>
        </div>

        <ProveedoresCampo
          proveedores={proveedores}
          seleccionados={usuario.proveedoresAcceso.map((p) => p.id)}
        />

        <ClienteCampo clientes={opcionesClientes} seleccionado={usuario.clienteId} />

        <ModulosCampo seleccionados={usuario.modulos} />

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
