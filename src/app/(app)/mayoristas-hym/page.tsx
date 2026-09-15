import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { SubirArchivosHym } from "./subir-archivos-hym";

export default async function MayoristasHymPage() {
  await requireAdmin();

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Actualizar Stock y Precios — HYM</h1>
          <p className="mt-1 text-sm text-gray-500">
            Subí el <code>productos.csv</code> del scraper y el <code>Productos-Cambios_HyM.xlsx</code> con el
            mapeo de SKUs. Vas a poder revisar todos los cambios antes de aplicarlos en Tiendanube.
          </p>
        </div>
        <Link
          href="/mayoristas-hym/historial"
          className="shrink-0 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          Ver historial de corridas automáticas
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <SubirArchivosHym />
      </div>
    </div>
  );
}
