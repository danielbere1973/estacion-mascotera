import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

export default async function CombosPage() {
  const combos = await prisma.producto.findMany({
    where: { esCombo: true },
    orderBy: { nombre: "asc" },
    include: { componentesCombo: { include: { producto: { select: { nombre: true } } } } },
  });

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Link href="/inventario" className="text-xs text-gray-400 hover:text-gray-600">← Inventario</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Combos</h1>
        </div>
        <Link
          href="/inventario/combos/nuevo"
          className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Nuevo combo
        </Link>
      </div>

      <ul className="space-y-2">
        {combos.map((combo) => {
          const costo = Number(combo.precioCostoUnitario);
          const venta = Number(combo.precioVenta);
          const margen = costo > 0 ? ((venta - costo) / costo) * 100 : null;
          return (
            <li key={combo.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {combo.nombre} <span className="font-mono text-xs text-gray-400">· {combo.skuInterno}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {combo.componentesCombo.map((c) => `${c.cantidad}× ${c.producto.nombre}`).join(" + ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">{formatCurrency(venta)}</p>
                  {margen !== null && (
                    <p className={`text-xs ${margen >= 25 ? "text-green-600" : "text-orange-500"}`}>
                      Rentabilidad {margen.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2 border-t border-gray-100 pt-2">
                <Link
                  href={`/inventario/combos/${combo.id}/editar`}
                  className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                >
                  Editar
                </Link>
              </div>
            </li>
          );
        })}
        {combos.length === 0 && (
          <li className="py-6 text-center text-sm text-gray-400">Todavía no armaste ningún combo.</li>
        )}
      </ul>
    </div>
  );
}
