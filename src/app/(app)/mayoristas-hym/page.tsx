import { requireAdmin } from "@/lib/permissions";
import { SubirArchivosHym } from "./subir-archivos-hym";

export default async function MayoristasHymPage() {
  await requireAdmin();

  return (
    <div className="space-y-4 w-full">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Actualizar Stock y Precios — HYM</h1>
        <p className="mt-1 text-sm text-gray-500">
          Subí el <code>productos.csv</code> del scraper y el <code>Productos-Cambios_HyM.xlsx</code> con el
          mapeo de SKUs. Vas a poder revisar todos los cambios antes de aplicarlos en Tiendanube.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <SubirArchivosHym />
      </div>
    </div>
  );
}
