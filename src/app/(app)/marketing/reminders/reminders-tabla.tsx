"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatDate } from "@/lib/format";
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

// Próximo reminder = hoy + (setup reminder - días transcurridos).
// Si los días transcurridos superan el Setup reminder, el 1° del mes siguiente a hoy.
function calcularProximo(hoy: string, setup: number, diasTranscurridos: number | null) {
  if (diasTranscurridos === null) return null;
  if (diasTranscurridos > setup) {
    const [anio, mes] = hoy.split("-").map(Number);
    return new Date(Date.UTC(anio, mes, 1, 12)); // `mes` es 1-based, como índice 0-based es el mes siguiente
  }
  return new Date(aFecha(hoy).getTime() + (setup - diasTranscurridos) * DIA_MS);
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

// Reminder enviado: al cliente se le envió un reminder desde su última compra (mismo criterio
// que usa "Enviar reminders" para no reenviar) y hasta el próximo reminder, inclusive.
// Sin compras, alcanza con que se le haya enviado. Si no, cruz.
function reminderEnviado(fila: FilaReminder, proximo: Date | null) {
  const envio = fila.ultimoReminderFecha;
  if (!envio) return false;
  if (fila.ultimaVentaFecha && envio < fila.ultimaVentaFecha) return false;
  return !proximo || envio <= proximo.toISOString().slice(0, 10);
}

function TextoEditable({
  guardado,
  obligatorio,
  onGuardar,
}: {
  guardado: string;
  obligatorio?: boolean;
  onGuardar: (valor: string) => void;
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
      className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm"
    />
  );
}

// `mostrarStatus`: el combo de Status va solo en la primera fila de cada cliente y se aplica a todas sus mascotas.
function Fila({ fila, hoy, mostrarStatus }: { fila: FilaReminder; hoy: string; mostrarStatus: boolean }) {
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
  const proximo = calcularProximo(hoy, setup, diasTranscurridos);
  const enviado = reminderEnviado(fila, proximo);
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

  return (
    <tr className={`hover:bg-gray-50 ${pending ? "opacity-60" : ""}`}>
      <td className="px-3 py-2 font-medium">{fila.cliente}</td>
      <td className="px-3 py-2 text-gray-600">
        {esMascota ? (
          <TextoEditable guardado={fila.mascota ?? ""} obligatorio onGuardar={(v) => editarMascota("nombre", v)} />
        ) : (
          <TextoEditable guardado={borrador.nombre} onGuardar={(v) => editarBorrador({ nombre: v })} />
        )}
      </td>
      <td className="px-3 py-2 text-gray-600">
        {esMascota && tipo ? (
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoMascota);
              editarMascota("tipo", e.target.value);
            }}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
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
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">-</option>
            {Object.entries(TIPO_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="px-3 py-2 text-gray-600">
        {esMascota ? (
          <TextoEditable guardado={fila.raza ?? ""} onGuardar={(v) => editarMascota("raza", v)} />
        ) : (
          <TextoEditable guardado={borrador.raza} onGuardar={(v) => editarBorrador({ raza: v })} />
        )}
      </td>
      <td className="px-3 py-2 text-gray-600">{fila.tieneEmail ? "SI" : "NO"}</td>
      <td className="px-3 py-2 text-gray-600">
        {fila.ultimaVentaId ? (
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
        )}
      </td>
      <td className="px-3 py-2 text-gray-600">
        {fila.ultimaVentaFecha ? formatDate(aFecha(fila.ultimaVentaFecha)) : "-"}
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-block min-w-10 rounded-md px-2 py-1 text-center ${
            colorDiasTranscurridos(diasTranscurridos, setup) || "text-gray-600"
          }`}
        >
          {diasTranscurridos ?? "-"}
        </span>
      </td>
      <td className="px-3 py-2">
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
      </td>
      <td className="px-3 py-2 text-gray-600">{proximo ? formatDate(proximo) : "-"}</td>
      <td className="px-3 py-2 text-center">
        {enviado ? (
          <span className="text-lg font-bold text-green-600" title={`Enviado el ${formatDate(aFecha(fila.ultimoReminderFecha!))}`}>
            ✓
          </span>
        ) : (
          <span className="text-lg font-bold text-red-600" title="Sin reminder enviado">
            ✗
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {mostrarStatus && (
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
        )}
      </td>
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
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2">Cliente</th>
            <th className="px-3 py-2">Mascota</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Raza</th>
            <th className="px-3 py-2">Mail</th>
            <th className="px-3 py-2">Última compra</th>
            <th className="px-3 py-2">Fecha última compra</th>
            <th className="px-3 py-2">Días transcurridos</th>
            <th className="px-3 py-2">Setup reminder</th>
            <th className="px-3 py-2">Próximo reminder</th>
            <th className="px-3 py-2">Reminder enviado</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Force Mail</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filas.map((f, i) => (
            // Primera fila visible del cliente (las filas vienen ordenadas por cliente).
            <Fila key={f.key} fila={f} hoy={hoy} mostrarStatus={filas.findIndex((g) => g.clienteId === f.clienteId) === i} />
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={13} className="px-3 py-6 text-center text-gray-400">
                {mensajeVacio}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
