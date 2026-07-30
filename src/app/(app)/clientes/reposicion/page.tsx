"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { generarRecordatorios, marcarEnviado } from "../actions";
import { formatCurrency } from "@/lib/format";

function formatFecha(d: Date) {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ReposicionPage() {
  await requireAdmin();

  // Generar/actualizar recordatorios para clientes recurrentes
  await generarRecordatorios();

  const hoy = new Date();
  const en7dias = new Date(hoy);
  en7dias.setDate(hoy.getDate() + 7);

  const recordatorios = await prisma.recordatorioReposicion.findMany({
    where: {
      enviado: false,
      fechaEstimadaReposicion: { lte: en7dias },
    },
    include: {
      cliente: true,
      producto: { select: { id: true, nombre: true, sku: true } },
    },
    orderBy: { fechaEstimadaReposicion: "asc" },
  });

  const vencidos = recordatorios.filter(r => r.fechaEstimadaReposicion < hoy);
  const proximos = recordatorios.filter(r => r.fechaEstimadaReposicion >= hoy);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Reposiciones pendientes</h1>
        <span className="text-sm text-gray-500">{recordatorios.length} contactos pendientes</span>
      </div>

      {recordatorios.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-gray-400 text-sm">
          No hay reposiciones pendientes para los próximos 7 días.
        </div>
      )}

      {vencidos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-red-600 tracking-wide">Vencidos</h2>
          <div className="space-y-2">
            {vencidos.map(r => (
              <RecordatorioCard key={r.id} r={r} vencido />
            ))}
          </div>
        </section>
      )}

      {proximos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-gray-500 tracking-wide">Próximos 7 días</h2>
          <div className="space-y-2">
            {proximos.map(r => (
              <RecordatorioCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RecordatorioCard({ r, vencido = false }: { r: any; vencido?: boolean }) {
  const waUrl = `https://wa.me/${r.cliente.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(r.mensaje)}`;

  return (
    <div className={`rounded-xl border bg-white p-4 ${vencido ? "border-red-200" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              {r.cliente.nombre} {r.cliente.apellido}
            </span>
            <span className="text-xs text-gray-400">{r.cliente.telefono}</span>
            {vencido && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                Vencido
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">{r.producto.nombre}</span>
            {" · "}última compra: {new Date(r.fechaUltimaCompra).toLocaleDateString("es-AR")}
            {" · "}reposición estimada: <span className={vencido ? "text-red-600 font-medium" : "text-gray-700"}>
              {new Date(r.fechaEstimadaReposicion).toLocaleDateString("es-AR")}
            </span>
          </div>
          <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 border border-gray-100">
            {r.mensaje}
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </a>

          <form action={marcarEnviado}>
            <input type="hidden" name="id" value={r.id} />
            <button
              type="submit"
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              Marcar enviado
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
