import Link from "next/link";
import { prisma } from "@/lib/prisma";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export default async function ConsignacionesPage() {
  const socios = await prisma.socioConsignacion.findMany({
    include: {
      consignaciones: {
        where: { estado: "ABIERTA" },
        include: {
          items: { include: { ventas: { where: { liquidacionId: null } } } },
        },
      },
      liquidaciones: { where: { pagado: false }, orderBy: { fecha: "desc" }, take: 1 },
    },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Consignaciones</h1>
        <div className="flex gap-2">
          <Link href="/consignaciones/socios" className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Socios
          </Link>
          <Link href="/consignaciones/nueva" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            + Nueva consignación
          </Link>
        </div>
      </div>

      {socios.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-gray-400">
          <p className="mb-3">No hay socios comerciales cargados.</p>
          <Link href="/consignaciones/socios/nuevo" className="text-blue-600 hover:underline text-sm">
            Agregar primer socio →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {socios.map((socio) => {
            // Calcular saldo pendiente
            let aCobrarnos = 0;
            let aCobrarles = 0;
            for (const c of socio.consignaciones) {
              for (const item of c.items) {
                const vendido = item.ventas.reduce((s, v) => s + v.cantidad, 0);
                const monto = vendido * Number(item.precioPiso);
                if (c.direccion === "ENTREGAMOS") aCobrarnos += monto;
                else aCobrarles += monto;
              }
            }
            const saldo = aCobrarnos - aCobrarles;
            const liquidacionPendiente = socio.liquidaciones[0];

            return (
              <Link key={socio.id} href={`/consignaciones/cuenta-corriente/${socio.id}`}
                className="rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-200 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-semibold text-gray-900">{socio.nombre}</h2>
                    {socio.contacto && <p className="text-xs text-gray-400 mt-0.5">{socio.contacto}</p>}
                  </div>
                  <span className={`text-sm font-semibold ${saldo > 0 ? "text-green-700" : saldo < 0 ? "text-red-600" : "text-gray-400"}`}>
                    {saldo > 0 ? "Te deben" : saldo < 0 ? "Debés" : "Sin saldo"}
                    {saldo !== 0 && ` ${formatCurrency(Math.abs(saldo))}`}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>{socio.consignaciones.length} consignaciones abiertas</span>
                  {liquidacionPendiente && (
                    <span className="text-orange-600">Liquidación pendiente de pago</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex gap-4">
        <Link href="/consignaciones/liquidaciones" className="text-sm text-blue-600 hover:underline">
          Ver todas las liquidaciones →
        </Link>
        <Link href="/consignaciones/dropshipping" className="text-sm text-blue-600 hover:underline">
          Dropshipping →
        </Link>
      </div>
    </div>
  );
}
