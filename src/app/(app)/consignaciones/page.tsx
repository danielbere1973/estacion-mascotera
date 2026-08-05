import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export default async function ConsignacionesPage() {
  const session = await auth();
  const esRestringido = session?.user?.rol === "LECTOR_RESTRINGIDO";
  const proveedorRestrictoId = session?.user?.proveedorRestrictoId;

  const socios = await prisma.socioConsignacion.findMany({
    where: esRestringido && proveedorRestrictoId
      ? { proveedorId: proveedorRestrictoId }
      : undefined,
    include: {
      consignaciones: {
        where: { estado: "ABIERTA" },
        include: {
          items: {
            include: {
              ventas: { where: { liquidacionId: null } },
            },
          },
        },
      },
      liquidaciones: { where: { pagado: false }, orderBy: { fecha: "desc" }, take: 1 },
    },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Consignaciones</h1>
        {!esRestringido && (
          <div className="flex gap-2">
            <Link href="/consignaciones/socios" className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Socios
            </Link>
            <Link href="/consignaciones/nueva" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              + Nueva consignación
            </Link>
          </div>
        )}
      </div>

      {socios.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-gray-400">
          <p className="mb-3">No hay socios comerciales cargados.</p>
          {!esRestringido && (
            <Link href="/consignaciones/socios/nuevo" className="text-blue-600 hover:underline text-sm">
              Agregar primer socio →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {socios.map((socio) => {
            let aCobrarnos = 0;
            let aCobrarles = 0;

            const consignacionesConResumen = socio.consignaciones.map((c) => {
              let productos = 0;
              let unidades = 0;
              for (const item of c.items) {
                const costo = Number(item.precioCosto);
                productos++;
                for (const v of item.ventas) {
                  unidades += v.cantidad;
                  const ganancia = Number(v.precioVentaReal) - costo;
                  const monto = (costo + ganancia / 3) * v.cantidad;
                  if (c.direccion === "ENTREGAMOS") aCobrarnos += monto;
                  else aCobrarles += monto;
                }
              }
              return { id: c.id, direccion: c.direccion, productos, unidades };
            });

            const saldo = aCobrarnos - aCobrarles;
            const liquidacionPendiente = socio.liquidaciones[0];

            const href = esRestringido && socio.consignaciones.length === 1
              ? `/consignaciones/${socio.consignaciones[0].id}`
              : `/consignaciones/cuenta-corriente/${socio.id}`;

            return (
              <Link key={socio.id} href={href}
                className="rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-200 hover:shadow-sm transition-all block">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h2 className="font-semibold text-gray-900">{socio.nombre}</h2>
                    {socio.contacto && <p className="text-xs text-gray-400 mt-0.5">{socio.contacto}</p>}
                  </div>
                  {!esRestringido && saldo !== 0 && (
                    <div className="text-right">
                      <p className={`text-sm font-bold ${saldo > 0 ? "text-green-700" : "text-red-600"}`}>
                        {fmt(Math.abs(saldo))}
                      </p>
                      <p className={`text-xs ${saldo > 0 ? "text-green-600" : "text-red-500"}`}>
                        {saldo > 0 ? "te deben" : "debés"}
                      </p>
                    </div>
                  )}
                  {!esRestringido && saldo === 0 && (
                    <span className="text-xs text-gray-400">Sin saldo</span>
                  )}
                </div>

                {/* Consignaciones abiertas */}
                {consignacionesConResumen.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                    {consignacionesConResumen.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-xs">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          c.direccion === "ENTREGAMOS"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                        }`}>
                          {c.direccion === "ENTREGAMOS" ? "Entregamos" : "Recibimos"}
                        </span>
                        <span className="text-gray-500">
                          {c.productos} {c.productos === 1 ? "producto" : "productos"} · {c.unidades} {c.unidades === 1 ? "unidad vendida" : "unidades vendidas"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                  <span>{socio.consignaciones.length} consignación{socio.consignaciones.length !== 1 ? "es" : ""} abierta{socio.consignaciones.length !== 1 ? "s" : ""}</span>
                  {!esRestringido && liquidacionPendiente && (
                    <span className="text-amber-600 font-medium">⚠ Liquidación pendiente</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!esRestringido && (
        <div className="flex gap-4">
          <Link href="/consignaciones/liquidaciones" className="text-sm text-blue-600 hover:underline">
            Ver todas las liquidaciones →
          </Link>
          <Link href="/consignaciones/dropshipping" className="text-sm text-blue-600 hover:underline">
            Dropshipping →
          </Link>
        </div>
      )}
    </div>
  );
}
