"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { ThOrdenable, useOrden, type ValorOrden } from "@/components/orden-tabla";
import { formatDate } from "@/lib/format";
import { DIAS_ENTRE_REMINDERS } from "@/lib/reminders-reglas";
import type { StatusReminder, TipoMascota } from "@prisma/client";
import {
  actualizarDatoMascota,
  actualizarSetupReminder,
  actualizarStatusReminder,
  crearMascotaDesdeReminders,
  enviarReminderForzado,
  type CampoMascota,
  type DestinoReminder,
} from "./actions";

// Una fila por mascota, o por cliente si no tiene mascotas cargadas (en ese caso
// setup y status se guardan en el Cliente).
export type FilaReminder = {
  key: string;
  destino: DestinoReminder;
  id: number; // id de la Mascota o del Cliente, según `destino`
  clienteId: number;
  cliente: string;
  mascota: string | null;
  tipo: TipoMascota | null;
  raza: string | null;
  tieneEmail: boolean; // el cliente tiene email cargado
  ultimoReminderFecha: string | null; // YYYY-MM-DD, último reminder enviado OK al cliente
  ultimaVentaId: number | null;
  ultimaVentaFecha: string | null; // YYYY-MM-DD
  setupReminderDias: number;
  statusReminder: StatusReminder;
  statusCliente: StatusReminder; // Activo si alguna mascota del cliente lo está (o el cliente sin mascota)
};

const TIPO_LABEL: Record<TipoMascota, string> = { PERRO: "Perro", GATO: "Gato" };

const DIA_MS = 24 * 60 * 60 * 1000;

function aFecha(dia: string) {
  return new Date(`${dia}T12:00:00Z`);
}

// Días transcurridos = hoy - fecha de la última compra.
function calcularDiasTranscurridos(ultimaVentaFecha: string | null, hoy: string) {
  if (!ultimaVentaFecha) return null;
  return Math.round((aFecha(hoy).getTime() - aFecha(ultimaVentaFecha).getTime()) / DIA_MS);
}

function sumarDias(dia: string, dias: number) {
  return new Date(aFecha(dia).getTime() + dias * DIA_MS);
}

// Próximo reminder: el primer día en que se le envía según las reglas del envío, o sea
// con más días desde la última compra que el Setup reminder (última compra + setup + 1) y a
// DIAS_ENTRE_REMINDERS días o más del último reminder. Si esa fecha ya pasó (está pendiente), hoy.
function calcularProximo(hoy: string, setup: number, fila: FilaReminder) {
  if (!fila.ultimaVentaFecha) return null;
  let proximo = sumarDias(fila.ultimaVentaFecha, setup + 1);
  if (fila.ultimoReminderFecha) {
    const porUltimoReminder = sumarDias(fila.ultimoReminderFecha, DIAS_ENTRE_REMINDERS);
    if (porUltimoReminder > proximo) proximo = porUltimoReminder;
  }
  return proximo < aFecha(hoy) ? aFecha(hoy) : proximo;
}

// Texto editable inline (Mascota y Raza): guarda al salir del campo o con Enter.
// `obligatorio`: si queda vacío vuelve al último valor guardado.
// Fondo de "Días transcurridos" según el Setup reminder:
// verde hasta 1/3 del setup, amarillo hasta el setup, rojo si lo supera.
function colorDiasTranscurridos(diasTranscurridos: number | null, setup: number) {
  if (diasTranscurridos === null) return "";
  if (diasTranscurridos * 3 <= setup) return "bg-green-200 text-green-900";
  if (diasTranscurridos <= setup) return "bg-yellow-200 text-yellow-900";
  return "bg-red-200 text-red-900";
}

// Reminder enviado: al cliente se le envió un reminder en los últimos DIAS_ENTRE_REMINDERS
// días (mismo criterio que usa "Enviar reminders" para no repetir). Si no, cruz.
function reminderEnviado(fila: FilaReminder, hoy: string) {
  const envio = fila.ultimoReminderFecha;
  return !!envio && sumarDias(envio, DIAS_ENTRE_REMINDERS) > aFecha(hoy);
}

function TextoEditable({
  guardado,
  obligatorio,
  onGuardar,
  className = "w-32",
}: {
  guardado: string;
  obligatorio?: boolean;
  onGuardar: (valor: string) => void;
  className?: string;
}) {
  const [valor, setValor] = useState(guardado);
  // Si el valor cambia desde el server, sincronizar el input.
  const [valorServer, setValorServer] = useState(guardado);
  if (guardado !== valorServer) {
    setValorServer(guardado);
    setValor(guardado);
  }
  return (
    <input
      type="text"
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setValor(guardado);
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        const texto = valor.trim();
        if (obligatorio && !texto) {
          setValor(guardado);
          return;
        }
        setValor(texto);
        if (texto !== guardado) onGuardar(texto);
      }}
      placeholder="-"
      className={`${className} rounded-md border border-gray-300 px-2 py-1 text-sm`}
    />
  );
}

// `mostrarStatus`: el combo de Status va solo en la primera fila de cada cliente y se aplica a todas sus mascotas.
// `vista`: "tabla" (fila de la tabla en desktop) o "tarjeta" (mobile); misma lógica y mismos datos.
function Fila({
  fila,
  hoy,
  mostrarStatus,
  vista = "tabla",
}: {
  fila: FilaReminder;
  hoy: string;
  mostrarStatus: boolean;
  vista?: "tabla" | "tarjeta";
}) {
  const [dias, setDias] = useState(fila.setupReminderDias.toString());
  const [status, setStatus] = useState(fila.statusCliente);
  // Si el status cambia desde el server (p. ej. el switch "Todo Activo/Pausado"), sincronizar el select.
  const [statusServer, setStatusServer] = useState(fila.statusCliente);
  if (fila.statusCliente !== statusServer) {
    setStatusServer(fila.statusCliente);
    setStatus(fila.statusCliente);
  }
  const [pending, startTransition] = useTransition();
  const diasTranscurridos = calcularDiasTranscurridos(fila.ultimaVentaFecha, hoy);
  // Usa el setup que se está editando; si no es válido, el último guardado.
  const setupNum = Number.parseInt(dias, 10);
  const setup = Number.isFinite(setupNum) && setupNum >= 1 ? setupNum : fila.setupReminderDias;
  const proximo = calcularProximo(hoy, setup, fila);
  const enviado = reminderEnviado(fila, hoy);
  const [tipo, setTipo] = useState(fila.tipo);
  const [tipoServer, setTipoServer] = useState(fila.tipo);
  if (fila.tipo !== tipoServer) {
    setTipoServer(fila.tipo);
    setTipo(fila.tipo);
  }
  // Mascota, Tipo y Raza solo se editan en filas de mascota (se guardan en la tabla Mascota).
  const editarMascota = (campo: CampoMascota, valor: string) =>
    startTransition(() => actualizarDatoMascota(fila.id, campo, valor));
  const esMascota = fila.destino === "mascota";
  // Cliente sin mascota: lo cargado queda en borrador hasta tener Mascota y Tipo; ahí se crea la mascota.
  const [borrador, setBorrador] = useState<{ nombre: string; tipo: TipoMascota | ""; raza: string }>({
    nombre: "",
    tipo: "",
    raza: "",
  });
  const editarBorrador = (cambio: Partial<typeof borrador>) => {
    const b = { ...borrador, ...cambio };
    setBorrador(b);
    if (b.nombre && b.tipo) startTransition(() => crearMascotaDesdeReminders(fila.id, b.nombre, b.tipo, b.raza));
  };
  const ayudaBorrador = "Completá Mascota y Tipo para crear la mascota";
  const ancho = vista === "tarjeta" ? "w-full" : undefined;

  const celdaMascota = esMascota ? (
    <TextoEditable guardado={fila.mascota ?? ""} obligatorio onGuardar={(v) => editarMascota("nombre", v)} className={ancho} />
  ) : (
    <TextoEditable guardado={borrador.nombre} onGuardar={(v) => editarBorrador({ nombre: v })} className={ancho} />
  );

  const celdaTipo =
    esMascota && tipo ? (
      <select
        value={tipo}
        onChange={(e) => {
          setTipo(e.target.value as TipoMascota);
          editarMascota("tipo", e.target.value);
        }}
        className={`${ancho ?? ""} rounded-md border border-gray-300 px-2 py-1 text-sm`}
      >
        {Object.entries(TIPO_LABEL).map(([valor, label]) => (
          <option key={valor} value={valor}>
            {label}
          </option>
        ))}
      </select>
    ) : (
      <select
        value={borrador.tipo}
        onChange={(e) => editarBorrador({ tipo: e.target.value as TipoMascota | "" })}
        title={ayudaBorrador}
        className={`${ancho ?? ""} rounded-md border border-gray-300 px-2 py-1 text-sm`}
      >
        <option value="">-</option>
        {Object.entries(TIPO_LABEL).map(([valor, label]) => (
          <option key={valor} value={valor}>
            {label}
          </option>
        ))}
      </select>
    );

  const celdaRaza = esMascota ? (
    <TextoEditable guardado={fila.raza ?? ""} onGuardar={(v) => editarMascota("raza", v)} className={ancho} />
  ) : (
    <TextoEditable guardado={borrador.raza} onGuardar={(v) => editarBorrador({ raza: v })} className={ancho} />
  );

  const linkUltimaVenta = fila.ultimaVentaId ? (
    <Link
      href={`/ventas/${fila.ultimaVentaId}/editar`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline"
    >
      #{fila.ultimaVentaId}
    </Link>
  ) : (
    "-"
  );

  const fechaUltimaVenta = fila.ultimaVentaFecha ? formatDate(aFecha(fila.ultimaVentaFecha)) : "-";

  const badgeDias = (
    <span
      className={`inline-block min-w-10 rounded-md px-2 py-1 text-center ${
        colorDiasTranscurridos(diasTranscurridos, setup) || "text-gray-600"
      }`}
    >
      {diasTranscurridos ?? "-"}
    </span>
  );

  const inputSetup = (
    <input
      type="number"
      min={1}
      required
      value={dias}
      onChange={(e) => setDias(e.target.value)}
      onBlur={() => {
        const guardado = fila.setupReminderDias.toString();
        const n = Number.parseInt(dias, 10);
        // No se permite vacío ni menor a 1: vuelve al último valor guardado.
        if (!Number.isFinite(n) || n < 1) {
          setDias(guardado);
          return;
        }
        if (n.toString() !== guardado) {
          setDias(n.toString());
          startTransition(() => actualizarSetupReminder(fila.destino, fila.id, n.toString()));
        }
      }}
      placeholder="días"
      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
    />
  );

  const marcaEnviado = enviado ? (
    <span className="text-lg font-bold text-green-600" title={`Enviado el ${formatDate(aFecha(fila.ultimoReminderFecha!))}`}>
      ✓
    </span>
  ) : (
    <span className="text-lg font-bold text-red-600" title={`Sin reminder enviado en los últimos ${DIAS_ENTRE_REMINDERS} días`}>
      ✗
    </span>
  );

  const selectStatus = mostrarStatus && (
    <select
      value={status}
      onChange={(e) => {
        setStatus(e.target.value as StatusReminder);
        startTransition(() => actualizarStatusReminder(fila.destino, fila.id, e.target.value));
      }}
      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
    >
      <option value="ACTIVO">Activo</option>
      <option value="PAUSADO">Pausado</option>
    </select>
  );

  if (vista === "tarjeta") {
    return (
      <li className={`rounded-xl border border-gray-200 bg-white p-3 text-sm ${pending ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 font-medium text-gray-900">{fila.cliente}</p>
          {mostrarStatus && (
            <div className="flex shrink-0 items-center gap-2">
              {selectStatus}
              <ForceMail fila={fila} />
            </div>
          )}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-500">Mascota</label>
            {celdaMascota}
          </div>
          <div>
            <label className="text-xs text-gray-500">Tipo</label>
            {celdaTipo}
          </div>
          <div>
            <label className="text-xs text-gray-500">Raza</label>
            {celdaRaza}
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Mail: {fila.tieneEmail ? "SI" : "NO"} · Última compra {linkUltimaVenta} ({fechaUltimaVenta})
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-2 text-xs text-gray-600">
          <span className="flex items-center gap-1">Días {badgeDias}</span>
          <span className="flex items-center gap-1">Setup {inputSetup}</span>
          <span>Próximo: {proximo ? formatDate(proximo) : "-"}</span>
          <span className="flex items-center gap-1">Enviado {marcaEnviado}</span>
        </div>
      </li>
    );
  }

  return (
    <tr className={`hover:bg-gray-50 ${pending ? "opacity-60" : ""}`}>
      <td className="px-3 py-2 font-medium">{fila.cliente}</td>
      <td className="px-3 py-2 text-gray-600">{celdaMascota}</td>
      <td className="px-3 py-2 text-gray-600">{celdaTipo}</td>
      <td className="px-3 py-2 text-gray-600">{celdaRaza}</td>
      <td className="px-3 py-2 text-gray-600">{fila.tieneEmail ? "SI" : "NO"}</td>
      <td className="px-3 py-2 text-gray-600">{linkUltimaVenta}</td>
      <td className="px-3 py-2 text-gray-600">{fechaUltimaVenta}</td>
      <td className="px-3 py-2">{badgeDias}</td>
      <td className="px-3 py-2">{inputSetup}</td>
      <td className="px-3 py-2 text-gray-600">{proximo ? formatDate(proximo) : "-"}</td>
      <td className="px-3 py-2 text-center">{marcaEnviado}</td>
      <td className="px-3 py-2">{selectStatus}</td>
      <td className="px-3 py-2 text-center">
        {mostrarStatus && <ForceMail fila={fila} />}
      </td>
    </tr>
  );
}

// Force Mail: envía el reminder al cliente ignorando todas las reglas (previa confirmación).
function ForceMail({ fila }: { fila: FilaReminder }) {
  const [pending, startTransition] = useTransition();
  const enviar = () => {
    if (!window.confirm(`¿Enviar el mail de reminder a ${fila.cliente} ahora, sin aplicar ninguna regla?`)) return;
    startTransition(async () => {
      const r = await enviarReminderForzado(fila.clienteId);
      window.alert(r.error ? `No se pudo enviar: ${r.error}` : `Reminder enviado a ${fila.cliente}.`);
    });
  };
  return (
    <button
      type="button"
      onClick={enviar}
      disabled={pending || !fila.tieneEmail}
      title={fila.tieneEmail ? "Enviar reminder ahora (Force Mail)" : "El cliente no tiene email"}
      aria-label="Force Mail"
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
    >
      {pending ? (
        <span className="text-xs">…</span>
      ) : (
        <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
        </svg>
      )}
    </button>
  );
}

type Columna =
  | "cliente"
  | "mascota"
  | "tipo"
  | "raza"
  | "mail"
  | "ultimaCompra"
  | "fechaUltimaCompra"
  | "diasTranscurridos"
  | "setup"
  | "proximo"
  | "enviado"
  | "status";

const COLUMNAS: { label: string; columna?: Columna }[] = [
  { label: "Cliente", columna: "cliente" },
  { label: "Mascota", columna: "mascota" },
  { label: "Tipo", columna: "tipo" },
  { label: "Raza", columna: "raza" },
  { label: "Mail", columna: "mail" },
  { label: "Última compra", columna: "ultimaCompra" },
  { label: "Fecha última compra", columna: "fechaUltimaCompra" },
  { label: "Días transcurridos", columna: "diasTranscurridos" },
  { label: "Setup reminder", columna: "setup" },
  { label: "Próximo reminder", columna: "proximo" },
  { label: "Reminder enviado", columna: "enviado" },
  { label: "Status", columna: "status" },
  { label: "Force Mail" },
];

// Valor por el que se ordena cada columna (null = sin dato, siempre al final).
// Las columnas calculadas usan el Setup reminder guardado.
function valorOrden(fila: FilaReminder, columna: Columna, hoy: string): ValorOrden {
  switch (columna) {
    case "cliente":
      return fila.cliente;
    case "mascota":
      return fila.mascota || null;
    case "tipo":
      return fila.tipo ? TIPO_LABEL[fila.tipo] : null;
    case "raza":
      return fila.raza || null;
    case "mail":
      return fila.tieneEmail ? "SI" : "NO";
    case "ultimaCompra":
      return fila.ultimaVentaId;
    case "fechaUltimaCompra":
      return fila.ultimaVentaFecha;
    case "diasTranscurridos":
      return calcularDiasTranscurridos(fila.ultimaVentaFecha, hoy);
    case "setup":
      return fila.setupReminderDias;
    case "proximo":
      return calcularProximo(hoy, fila.setupReminderDias, fila)?.getTime() ?? null;
    case "enviado":
      return reminderEnviado(fila, hoy) ? "SI" : "NO";
    case "status":
      return fila.statusCliente === "ACTIVO" ? "Activo" : "Pausado";
  }
}

// `hoy` (YYYY-MM-DD, hora Argentina) viene del server para que coincida con el render del cliente.
export function RemindersTabla({
  filas,
  hoy,
  mensajeVacio = "No hay clientes cargados todavía.",
}: {
  filas: FilaReminder[];
  hoy: string;
  mensajeVacio?: string;
}) {
  // Sin orden elegido, las filas quedan como vienen del server (por cliente).
  const valor = useCallback((f: FilaReminder, c: Columna) => valorOrden(f, c, hoy), [hoy]);
  const { ordenadas, orden, ordenar } = useOrden(filas, valor);

  // Primera fila visible de cada cliente: ahí van el combo de Status y Force Mail.
  const primeras = useMemo(() => {
    const vistos = new Set<number>();
    const keys = new Set<string>();
    for (const f of ordenadas) {
      if (vistos.has(f.clienteId)) continue;
      vistos.add(f.clienteId);
      keys.add(f.key);
    }
    return keys;
  }, [ordenadas]);

  return (
    <>
      {/* Mobile: tarjetas, en el orden en que vienen (por cliente). */}
      <ul className="space-y-2 md:hidden">
        {ordenadas.map((f) => (
          <Fila key={f.key} fila={f} hoy={hoy} mostrarStatus={primeras.has(f.key)} vista="tarjeta" />
        ))}
        {filas.length === 0 && <li className="py-6 text-center text-sm text-gray-400">{mensajeVacio}</li>}
      </ul>
    <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            {COLUMNAS.map(({ label, columna }) =>
              columna ? (
                <ThOrdenable key={label} label={label} columna={columna} orden={orden} onOrdenar={ordenar} />
              ) : (
                <th key={label} className="px-3 py-2">
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ordenadas.map((f) => (
            <Fila key={f.key} fila={f} hoy={hoy} mostrarStatus={primeras.has(f.key)} />
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={COLUMNAS.length} className="px-3 py-6 text-center text-gray-400">
                {mensajeVacio}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </>
  );
}
