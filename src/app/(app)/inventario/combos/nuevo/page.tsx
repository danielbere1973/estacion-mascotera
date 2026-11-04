import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { crearCombo } from "../../actions";
import { ComboComponentes } from "../combo-componentes";

export default async function NuevoComboPage() {
  const productos = await prisma.producto.findMany({
    where: { esCombo: false, activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, skuInterno: true, precioCostoUnitario: true },
  });

  const opciones = productos.map((p) => ({ ...p, precioCostoUnitario: p.precioCostoUnitario.toString() }));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/inventario/combos" className="text-xs text-gray-400 hover:text-gray-600">← Combos</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Nuevo combo</h1>
      </div>

      <form action={crearCombo} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Nombre del combo</label>
          <input name="nombre" required placeholder="Ej: Combo Bienvenida Perro" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Precio de venta</label>
          <input name="precioVenta" type="number" step="0.01" min={0} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <ComboComponentes productos={opciones} />

        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Crear combo
        </button>
      </form>
    </div>
  );
}
