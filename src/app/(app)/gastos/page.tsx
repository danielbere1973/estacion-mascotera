import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORIAS_GASTO_SUGERIDAS } from "@/lib/metrics";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { crearGasto, eliminarGasto } from "./actions";

export default async function GastosPage() {
  const [gastos, usuariosActivos] = await Promise.all([
    prisma.gasto.findMany({
      orderBy: { fechaGasto: "desc" },
      take: 50,
      include: { usuario: { select: { nombre: true } }, pagadoPor: { select: { nombre: true } } },
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, apellido: true },
    }),
  ]);

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Gastos</h1>

      <form
        action={crearGasto}
        className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            name="fechaGasto"
            defaultValue={hoy}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Tipo</label>
          <input
            name="categoriaGasto"
            list="categorias-gasto"
            required
            placeholder="Seleccionar o escribir..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <datalist id="categorias-gasto">
            {CATEGORIAS_GASTO_SUGERIDAS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Monto</label>
          <input
            type="number"
            name="monto"
            min={0}
            step="0.01"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Notas (opcional)</label>
          <input
            name="descripcion"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Pagado por</label>
          <select
            name="pagadoPorId"
            defaultValue=""
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Sin especificar</option>
            {usuariosActivos.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} {u.apellido}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Tipo de gasto</label>
          <select
            name="tipoGasto"
            required
            defaultValue="VARIABLE"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="FIJO">Fijo — impacta rentabilidad neta (no operativa)</option>
            <option value="VARIABLE">Variable — impacta rentabilidad operativa y neta</option>
            <option value="MARKETING">Marketing — impacta rentabilidad operativa y neta</option>
            <option value="EXCEPCIONAL">Excepcional — no impacta ninguna rentabilidad</option>
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
          >
            Registrar gasto
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2">Notas</th>
              <th className="px-3 py-2">Cargado por</th>
              <th className="px-3 py-2">Pagado por</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gastos.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2">{formatDate(g.fechaGasto)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {g.categoriaGasto}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {(() => {
                    const tipo = g.tipoGasto ?? (g.esFijo ? "FIJO" : "VARIABLE");
                    const cfg: Record<string, { label: string; cls: string }> = {
                      FIJO:        { label: "Fijo",        cls: "bg-gray-100 text-gray-600" },
                      VARIABLE:    { label: "Variable",    cls: "bg-blue-50 text-blue-600" },
                      MARKETING:   { label: "Marketing",   cls: "bg-purple-50 text-purple-600" },
                      EXCEPCIONAL: { label: "Excepcional", cls: "bg-orange-50 text-orange-600" },
                    };
                    const { label, cls } = cfg[tipo] ?? cfg.VARIABLE;
                    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
                  })()}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {formatCurrency(g.monto.toString())}
                </td>
                <td className="px-3 py-2 text-gray-500">{g.descripcion ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                  {g.usuario?.nombre ?? "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                  {g.pagadoPor?.nombre ?? "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/gastos/${g.id}/editar`}
                      className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      Editar
                    </Link>
                    <form action={eliminarGasto}>
                      <input type="hidden" name="id" value={g.id} />
                      <ConfirmSubmitButton
                        confirmMessage="¿Eliminar este gasto?"
                        className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Eliminar
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {gastos.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  No hay gastos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
