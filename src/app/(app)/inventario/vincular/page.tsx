import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { formatCurrency } from "@/lib/format";
import { VincularForm } from "./vincular-form";

export default async function VincularPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedorId?: string }>;
}) {
  await requireAdmin();

  const { proveedorId: proveedorIdParam } = await searchParams;

  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: {
        select: {
          historialMayorista: true,
        },
      },
    },
  });

  const proveedorId = proveedorIdParam ? Number(proveedorIdParam) : null;
  const proveedorSeleccionado = proveedores.find((p) => p.id === proveedorId) ?? null;

  const [items, productos] = await Promise.all([
    proveedorId
      ? prisma.historialStockMayorista.findMany({
          where: { proveedorId },
          include: { producto: { select: { id: true, nombre: true, marca: true } } },
          orderBy: [{ productoId: "asc" }, { nombre: "asc" }],
        })
      : Promise.resolve([]),
    prisma.producto.findMany({
      select: { id: true, nombre: true, marca: true, sku: true },
      orderBy: [{ marca: "asc" }, { nombre: "asc" }],
    }),
  ]);

  const vinculados = items.filter((i) => i.productoId !== null);
  const sinVincular = items.filter((i) => i.productoId === null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Vincular productos por proveedor</h1>
        <p className="text-sm text-gray-500 mt-1">
          Asociá los items de cada proveedor al producto del catálogo correspondiente.
        </p>
      </div>

      {/* Selector de proveedor */}
      <div className="flex flex-wrap gap-2">
        {proveedores.map((p) => (
          <a
            key={p.id}
            href={`?proveedorId=${p.id}`}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              proveedorId === p.id
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.nombre}
            <span className="ml-1.5 text-xs opacity-60">({p._count.historialMayorista})</span>
          </a>
        ))}
      </div>

      {!proveedorId && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">
          Seleccioná un proveedor para ver sus productos.
        </div>
      )}

      {proveedorId && items.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">
          Este proveedor no tiene items en la lista de precios.
        </div>
      )}

      {proveedorId && items.length > 0 && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <span className="text-green-700 font-medium">{vinculados.length} vinculados</span>
            <span className="text-orange-600 font-medium">{sinVincular.length} sin vincular</span>
          </div>

          {sinVincular.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-600">Sin vincular</h2>
              <div className="rounded-xl border border-orange-100 bg-white divide-y divide-gray-100">
                {sinVincular.map((item) => (
                  <div key={item.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-gray-800 text-sm">
                          {item.nombre ?? "—"}
                          {item.tamanios && <span className="ml-2 text-gray-400 text-xs">· {item.tamanios}</span>}
                        </div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{item.sku}</div>
                      </div>
                      <div className="text-sm text-gray-600 shrink-0">
                        {formatCurrency(item.precioCostoScraped.toString())}
                      </div>
                    </div>
                    <VincularForm
                      item={{
                        id: item.id,
                        sku: item.sku,
                        nombre: item.nombre,
                        tamanios: item.tamanios,
                        precioCostoScraped: item.precioCostoScraped.toString(),
                        productoId: item.productoId,
                        productoNombre: item.producto ? `${item.producto.marca} — ${item.producto.nombre}` : null,
                      }}
                      productos={productos}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {vinculados.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-green-700">Vinculados</h2>
              <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                {vinculados.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-800 text-sm">
                        {item.nombre ?? "—"}
                        {item.tamanios && <span className="ml-2 text-gray-400 text-xs">· {item.tamanios}</span>}
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">{item.sku}</div>
                    </div>
                    <VincularForm
                      item={{
                        id: item.id,
                        sku: item.sku,
                        nombre: item.nombre,
                        tamanios: item.tamanios,
                        precioCostoScraped: item.precioCostoScraped.toString(),
                        productoId: item.productoId,
                        productoNombre: item.producto ? `${item.producto.marca} — ${item.producto.nombre}` : null,
                      }}
                      productos={productos}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
