import { requireAdmin } from "@/lib/permissions";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { listarDuplicados, limpiarDuplicado, limpiarSimples } from "./actions";

export default async function AdminTempDuplicadosHymPage() {
  await requireAdmin();
  const grupos = await listarDuplicados();

  const requierenReasignacion = grupos.filter(
    (g) => !g.mismoProducto && g.base !== null && g.duplicado.productoId !== null && g.base.productoId !== null
  ).length;
  const simples = grupos.length - requierenReasignacion;

  return (
    <div className="w-full space-y-4">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        Página temporal para limpiar duplicados -Xkg de HYM en HistorialStockMayorista. Borrar esta carpeta
        (src/app/(app)/admin-temp-duplicados-hym) cuando termine la limpieza.
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600">
        <p className="mb-1">
          <span className="font-medium">¿Existe fila base?</span> — para cada fila con sufijo de tamaño (ej.{" "}
          <span className="font-mono text-xs">6403-10kg</span>) busca si también existe la fila sin sufijo (ej.{" "}
          <span className="font-mono text-xs">6403</span>) en la lista de HYM. Si dice &quot;no existe&quot;, esa
          fila -Xkg es la única versión de ese producto: no hay con qué comparar ni reasignar, se borra directo.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Duplicados HYM ({grupos.length})</h1>
        {simples > 0 && (
          <form action={limpiarSimples}>
            <ConfirmSubmitButton
              confirmMessage={`Se van a limpiar automáticamente ${simples} fila(s) sin conflicto (mismo producto o sin producto vinculado). Las ${requierenReasignacion} que requieren reasignar quedan para revisar a mano. ¿Continuar?`}
              className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700"
            >
              Limpiar {simples} sin conflicto de una vez
            </ConfirmSubmitButton>
          </form>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">SKU -Xkg (duplicado)</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Producto vinculado</th>
              <th className="px-3 py-2">SKU base ({"sin sufijo"})</th>
              <th className="px-3 py-2">¿Existe fila base?</th>
              <th className="px-3 py-2">¿Mismo producto?</th>
              <th className="px-3 py-2">Compras/Ventas/Pend. (duplicado)</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {grupos.map((g) => {
              const c = g.conteosDuplicado;
              const tieneMovimientos = c
                ? c.compras + c.ventas + c.pendientes + c.consignaciones + c.dropshipping + c.recurrentes + c.recordatorios > 0
                : false;
              const requiereReasignacion = !g.mismoProducto && g.base !== null && g.duplicado.productoId !== null && g.base.productoId !== null;

              return (
                <tr key={g.duplicado.historialId} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-red-700">{g.duplicado.sku}</td>
                  <td className="px-3 py-2">{g.duplicado.nombre ?? "-"}</td>
                  <td className="px-3 py-2 text-xs">
                    {g.duplicado.productoId ? (
                      <span>
                        #{g.duplicado.productoId} {g.duplicado.productoSkuInterno} — {g.duplicado.productoNombre}
                      </span>
                    ) : (
                      <span className="text-gray-300">sin vincular</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{g.baseSku}</td>
                  <td className="px-3 py-2 text-xs">
                    {g.base ? (
                      <span className="text-green-700">
                        sí (#{g.base.productoId ?? "sin vincular"} {g.base.productoSkuInterno ?? ""})
                      </span>
                    ) : (
                      <span className="text-gray-400">no existe</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {g.mismoProducto ? (
                      <span className="text-green-700">sí</span>
                    ) : requiereReasignacion ? (
                      <span className="font-medium text-orange-600">no — requiere reasignar</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {c ? (
                      <span className={tieneMovimientos ? "font-medium text-orange-600" : "text-gray-400"}>
                        {c.compras} / {c.ventas} / {c.pendientes}
                        {c.consignaciones + c.dropshipping + c.recurrentes + c.recordatorios > 0
                          ? ` (+${c.consignaciones + c.dropshipping + c.recurrentes + c.recordatorios} otros)`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-gray-300">sin producto</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <form action={limpiarDuplicado.bind(null, g.duplicado.historialId)}>
                      <ConfirmSubmitButton
                        confirmMessage={
                          requiereReasignacion
                            ? `"${g.duplicado.sku}" tiene movimientos y el producto es distinto al de "${g.baseSku}". Se van a reasignar compras/ventas/pendientes al producto base y luego se borra "${g.duplicado.sku}". ¿Continuar?`
                            : `¿Eliminar la fila "${g.duplicado.sku}"? No tiene conflicto de producto, se borra directo.`
                        }
                        className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                      >
                        Limpiar
                      </ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
            {grupos.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  No se encontraron filas con sufijo de tamaño en HYM.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
