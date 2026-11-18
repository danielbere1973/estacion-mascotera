import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { actualizarCombo } from "../../../actions";
import { ComboComponentes } from "../../combo-componentes";

export default async function EditarComboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const combo = await prisma.producto.findUnique({
    where: { id: Number(id), esCombo: true },
    include: { componentesCombo: true },
  });
  if (!combo) notFound();

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
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Editar combo</h1>
      </div>

      <form action={actualizarCombo} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="id" value={combo.id} />

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">SKU interno</label>
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-700">{combo.skuInterno}</p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Nombre del combo</label>
          <input name="nombre" required defaultValue={combo.nombre} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Precio de venta</label>
          <input name="precioVenta" type="number" step="0.01" min={0} required defaultValue={combo.precioVenta.toString()} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <ComboComponentes
          productos={opciones}
          iniciales={combo.componentesCombo.map((c) => ({ productoId: c.productoId, cantidad: c.cantidad }))}
        />

        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
