import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { marcarEnviado } from "../actions";

type Filtro = "todos" | "vencidos" | "proximos7" | "proximos30";

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatFecha(d: Date) {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ReposicionPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  await requireAdmin();

  const { filtro: filtroParam } = await searchParams;
  const filtro: Filtro = (["todos", "vencidos", "proximos7", "proximos30"].includes(filtroParam ?? "") ? filtroParam : "proximos7") as Filtro;

  // Traer todos los pares activos con su cliente y producto
  const pares = await prisma.clienteProductoRecurrente.findMany({
    where: { activo: true },
    include: {
      cliente: true,
      producto: { select: { id: true, nombre: true, marca: true, skuInterno: true } },
    },
    orderBy: [{ cliente: { apellido: "asc" } }, { cliente: { nombre: "asc" } }],
  });

  if (pares.length === 0) {
    return (
      <div className="w-full space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Reposiciones</h1>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">
          No hay productos recurrentes configurados.{" "}
          <span className="text-gray-500">Editá un cliente para agregar productos.</span>
        </div>
      </div>
    );
  }

  // Para cada par, buscar la última venta del producto para ese cliente
  const ultimasVentas = await prisma.detalleVenta.findMany({
    where: {
      productoId: { in: [...new Set(pares.map((p) => p.productoId))] },
      venta: {
        clienteId: { in: [...new Set(pares.map((p) => p.clienteId))] },
      },
    },
    select: {
      productoId: true,
      venta: { select: { clienteId: true, fechaVenta: true } },
    },
    orderBy: { venta: { fechaVenta: "desc" } },
  });

  // Construir mapa clienteId+productoId → última fecha de venta
  const mapaUltimaVenta = new Map<string, Date>();
  for (const dv of ultimasVentas) {
    const key = `${dv.venta.clienteId}:${dv.productoId}`;
    if (!mapaUltimaVenta.has(key)) {
      mapaUltimaVenta.set(key, dv.venta.fechaVenta);
    }
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Calcular próxima reposición para cada par
  const items = pares.map((par) => {
    const key = `${par.clienteId}:${par.productoId}`;
    const ultimaVenta = mapaUltimaVenta.get(key) ?? null;
    const proximaReposicion = ultimaVenta ? addDays(ultimaVenta, par.periodoDias) : null;
    const diasRestantes = proximaReposicion
      ? Math.round((proximaReposicion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    return { par, ultimaVenta, proximaReposicion, diasRestantes };
  });

  // Aplicar filtro
  const itemsFiltrados = items.filter(({ proximaReposicion, diasRestantes }) => {
    if (!proximaReposicion) return filtro === "todos";
    if (filtro === "vencidos") return diasRestantes !== null && diasRestantes < 0;
    if (filtro === "proximos7") return diasRestantes !== null && diasRestantes <= 7;
    if (filtro === "proximos30") return diasRestantes !== null && diasRestantes <= 30;
    return true; // todos
  });

  // Agrupar por cliente para el mensaje de WhatsApp
  const porCliente = new Map<number, typeof itemsFiltrados>();
  for (const item of itemsFiltrados) {
    const cid = item.par.clienteId;
    if (!porCliente.has(cid)) porCliente.set(cid, []);
    porCliente.get(cid)!.push(item);
  }

  const contadores = {
    vencidos: items.filter((i) => i.diasRestantes !== null && i.diasRestantes < 0).length,
    proximos7: items.filter((i) => i.diasRestantes !== null && i.diasRestantes <= 7).length,
    proximos30: items.filter((i) => i.diasRestantes !== null && i.diasRestantes <= 30).length,
    todos: items.length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Reposiciones</h1>
        <span className="text-sm text-gray-500">{itemsFiltrados.length} producto{itemsFiltrados.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            { value: "vencidos", label: "Vencidos", count: contadores.vencidos, color: "red" },
            { value: "proximos7", label: "Próximos 7 días", count: contadores.proximos7, color: "orange" },
            { value: "proximos30", label: "Próximos 30 días", count: contadores.proximos30, color: "blue" },
            { value: "todos", label: "Todos", count: contadores.todos, color: "gray" },
          ] as const
        ).map(({ value, label, count, color }) => {
          const activo = filtro === value;
          const colorMap = {
            red: activo ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-red-600 hover:bg-red-50",
            orange: activo ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-orange-600 hover:bg-orange-50",
            blue: activo ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-blue-600 hover:bg-blue-50",
            gray: activo ? "bg-gray-700 text-white border-gray-700" : "border-gray-200 text-gray-600 hover:bg-gray-50",
          };
          return (
            <a
              key={value}
              href={`?filtro=${value}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${colorMap[color]}`}
            >
              {label} <span className="ml-1 opacity-75">({count})</span>
            </a>
          );
        })}
      </div>

      {itemsFiltrados.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">
          No hay reposiciones en este período.
        </div>
      )}

      {/* Cards agrupadas por cliente */}
      {[...porCliente.entries()].map(([clienteId, clienteItems]) => {
        const { cliente } = clienteItems[0].par;

        // Mensaje de WhatsApp agrupado
        const lineasProductos = clienteItems
          .map(({ par, ultimaVenta }) =>
            `- ${par.producto.marca} ${par.producto.nombre}` +
            (ultimaVenta ? ` (última compra: ${formatFecha(ultimaVenta)})` : "")
          )
          .join("\n");
        const mensaje = `Hola ${cliente.nombre}! Te avisamos que se te pueden estar terminando:\n${lineasProductos}\nAvisanos y te lo preparamos. ¡Saludos!`;
        const waUrl = `https://wa.me/${cliente.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`;

        return (
          <div key={clienteId} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-gray-900">
                  {cliente.apellido}, {cliente.nombre}
                </div>
                <div className="text-xs text-gray-400">{cliente.telefono}</div>
              </div>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 shrink-0"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
            </div>

            <div className="space-y-1.5">
              {clienteItems.map(({ par, ultimaVenta, proximaReposicion, diasRestantes }) => {
                const vencido = diasRestantes !== null && diasRestantes < 0;
                const urgente = diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 3;
                return (
                  <div
                    key={par.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      vencido ? "bg-red-50 border border-red-100" : urgente ? "bg-orange-50 border border-orange-100" : "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    <div>
                      <span className="font-medium text-gray-800">{par.producto.marca} {par.producto.nombre}</span>
                      {par.notas && <span className="ml-2 text-xs text-gray-400">· {par.notas}</span>}
                      <div className="text-xs text-gray-500 mt-0.5">
                        {ultimaVenta ? `Última compra: ${formatFecha(ultimaVenta)}` : "Sin compras registradas"}
                        {" · "}cada {par.periodoDias} días
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      {proximaReposicion ? (
                        <>
                          <div className={`text-xs font-medium ${vencido ? "text-red-600" : urgente ? "text-orange-600" : "text-gray-600"}`}>
                            {vencido
                              ? `Vencido hace ${Math.abs(diasRestantes!)} días`
                              : diasRestantes === 0
                              ? "Vence hoy"
                              : `En ${diasRestantes} días`}
                          </div>
                          <div className="text-xs text-gray-400">{formatFecha(proximaReposicion)}</div>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">Sin fecha</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 whitespace-pre-line">
              {mensaje}
            </div>
          </div>
        );
      })}
    </div>
  );
}
