import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarProveedor } from "../../actions";
import Link from "next/link";

export default async function EditarProveedorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ volver?: string }>;
}) {
  const { id } = await params;
  const desdeModulo = (await searchParams).volver === "/proveedores";
  const proveedor = await prisma.proveedor.findUnique({ where: { id: Number(id) } });
  if (!proveedor) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href={desdeModulo ? "/proveedores" : "/inventario/proveedores"} className="text-xs text-gray-400 hover:text-gray-600">← Proveedores</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Editar proveedor</h1>
      </div>

      <form action={actualizarProveedor} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="id" value={proveedor.id} />
        {desdeModulo && <input type="hidden" name="volver" value="/proveedores" />}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Nombre</label>
          <input name="nombre" defaultValue={proveedor.nombre} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Teléfono</label>
          <input name="contacto" defaultValue={proveedor.contacto ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input name="email" type="email" defaultValue={proveedor.email ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Alias</label>
          <input name="alias" defaultValue={proveedor.alias ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">CBU/CVU</label>
          <input name="cbu" inputMode="numeric" defaultValue={proveedor.cbu ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Dirección</label>
          <input name="direccion" defaultValue={proveedor.direccion ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Account Manager</label>
          <input name="accountManager" defaultValue={proveedor.accountManager ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Horarios</label>
          <input name="horarios" defaultValue={proveedor.horarios ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
