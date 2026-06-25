import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarSocio } from "../../../actions";

export default async function EditarSocioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [socio, proveedores] = await Promise.all([
    prisma.socioConsignacion.findUnique({ where: { id: Number(id) } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);
  if (!socio) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Editar socio</h1>
      <form action={actualizarSocio} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="id" value={socio.id} />
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Nombre *</label>
          <input name="nombre" required defaultValue={socio.nombre} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Contacto</label>
          <input name="contacto" defaultValue={socio.contacto ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Proveedor vinculado</label>
          <select name="proveedorId" defaultValue={socio.proveedorId ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">— Sin vincular —</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Notas</label>
          <textarea name="notas" rows={2} defaultValue={socio.notas ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
