import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { perfilAcceso } from "@/lib/permissions";
import { traerPedidosMayoristas } from "@/lib/pedidos-mayoristas";
import { PedidoMayoristaItem } from "@/components/pedido-mayorista";
import { formatCurrency } from "@/lib/format";

// Mayorista > Carritos: todos los carritos confirmados desde el Catálogo mayorista (solo Administradores).
export default async function CarritosMayoristasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await perfilAcceso()).esAdmin) redirect("/");

  const { q } = await searchParams;
  const busqueda = q?.trim() ?? "";
  const numero = /^#?\d+$/.test(busqueda) ? Number(busqueda.replace("#", "")) : null;

  // Busca por número de pedido o por nombre/apellido del cliente.
  const filtro: Prisma.VentaWhereInput = busqueda
    ? {
        OR: [
          ...(numero != null ? [{ id: numero }] : []),
          { cliente: { nombre: { contains: busqueda, mode: "insensitive" } } },
          { cliente: { apellido: { contains: busqueda, mode: "insensitive" } } },
        ],
      }
    : {};

  const pedidos = await traerPedidosMayoristas(filtro);
  const total = pedidos.reduce((acc, p) => acc + p.total, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Carritos mayoristas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Todos los carritos confirmados desde el Catálogo mayorista. Tocá un pedido para ver el detalle.
        </p>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={busqueda}
          placeholder="Buscar por cliente o número de pedido..."
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm sm:max-w-sm"
        />
        <button type="submit" className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          Buscar
        </button>
        {busqueda && (
          <a
            href="/inventario/mayoristas-carritos"
            className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Limpiar
          </a>
        )}
      </form>

      <p className="text-xs text-gray-400">
        {pedidos.length} carrito{pedidos.length !== 1 ? "s" : ""} · Total {formatCurrency(total)}
      </p>

      <div className="space-y-2">
        {pedidos.map((p) => (
          <PedidoMayoristaItem
            key={p.id}
            pedido={p}
            mostrarCliente
            acciones={
              <>
                <Link href={`/clientes/${p.clienteId}`} className="text-xs text-gray-600 hover:underline">
                  Ver cliente
                </Link>
                <Link href={`/ventas/${p.id}/editar`} className="text-xs text-blue-600 hover:underline">
                  Ver / editar venta
                </Link>
              </>
            }
          />
        ))}
        {pedidos.length === 0 && (
          <p className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            {busqueda ? "No hay carritos que coincidan con la búsqueda." : "Todavía no se confirmó ningún carrito."}
          </p>
        )}
      </div>
    </div>
  );
}
