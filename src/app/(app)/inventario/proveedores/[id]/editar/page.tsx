import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarProveedor } from "../../actions";
import Link from "next/link";

export default async function EditarProveedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proveedor = await prisma.proveedor.findUnique({ where: { id: Number(id) } });
  if (!proveedor) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/inventario/proveedores" className="text-xs text-gray-400 hover:text-gray-600">← Proveedores</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Editar proveedor</h1>
      </div>

      <form action={actualizarProveedor} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="id" value={proveedor.id} />
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Nombre</label>
          <input name="nombre" defaultValue={proveedor.nombre} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Contacto</label>
          <input name="contacto" defaultValue={proveedor.contacto ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Dirección</label>
          <input name="direccion" defaultValue={proveedor.direccion ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
