import { prisma } from "@/lib/prisma";
import { crearSocio } from "../../actions";

export default async function NuevoSocioPage() {
  const proveedores = await prisma.proveedor.findMany({ orderBy: { nombre: "asc" } });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Nuevo socio comercial</h1>
      <form action={crearSocio} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Nombre *</label>
          <input name="nombre" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Contacto</label>
          <input name="contacto" placeholder="Teléfono, email..." className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Proveedor vinculado (opcional)</label>
          <p className="text-xs text-gray-400">Si ya existe como proveedor, vinculalo para heredar su lista de precios.</p>
          <select name="proveedorId" defaultValue="" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">— Sin vincular —</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Notas</label>
          <textarea name="notas" rows={2} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Crear socio
        </button>
      </form>
    </div>
  );
}
