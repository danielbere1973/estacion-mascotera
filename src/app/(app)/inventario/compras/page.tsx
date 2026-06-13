import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { ConfirmSubmitButton } from "@/components/confirm-button";
import { eliminarCompra } from "../actions";

export default async function ComprasPage() {
  const session = await auth();
  const esRestringido = session?.user?.rol === "LECTOR_RESTRINGIDO";

  const compras = await prisma.compra.findMany({
    where: esRestringido ? { proveedorId: session?.user?.proveedorRestrictoId ?? -1 } : undefined,
    include: { proveedor: true, producto: true },
    orderBy: { fechaCompra: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Compras</h1>
        {!esRestringido && (
          <Link
            href="/inventario/compra"
            className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Registrar compra
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Proveedor</th>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2 text-right">Cant.</th>
              <th className="px-3 py-2 text-right">Costo unit.</th>
              <th className="px-3 py-2 text-right">Desc.</th>
              <th className="px-3 py-2 text-right">Envío</th>
              <th className="px-3 py-2">Facturado</th>
              {!esRestringido && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {compras.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2">{formatDate(c.fechaCompra)}</td>
                <td className="whitespace-nowrap px-3 py-2">{c.proveedor.nombre}</td>
                <td className="px-3 py-2">
                  {c.producto.sku} · {c.producto.nombre}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{c.cantidad}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {formatCurrency(c.precioCostoUnitario.toString())}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {Number(c.descuentoPorcentaje) > 0 ? `${c.descuentoPorcentaje}%` : "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {formatCurrency((c.costoEnvio ?? 0).toString())}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {c.facturado ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      Sí {c.numeroFactura ? `· ${c.numeroFactura}` : ""}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      No
                    </span>
                  )}
                </td>
                {!esRestringido && (
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/inventario/compras/${c.id}/editar`}
                        className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                      >
                        Editar
                      </Link>
                      <form action={eliminarCompra}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmSubmitButton
                          confirmMessage="¿Eliminar esta compra? Se revertirá el stock cargado."
                          className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Eliminar
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {compras.length === 0 && (
              <tr>
                <td colSpan={esRestringido ? 8 : 9} className="px-3 py-6 text-center text-gray-400">
                  No hay compras registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
