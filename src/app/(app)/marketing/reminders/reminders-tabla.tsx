"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatDate } from "@/lib/format";
import type { StatusReminder, TipoMascota } from "@prisma/client";
import {
  actualizarDatoMascota,
  actualizarSetupReminder,
  actualizarStatusReminder,
  type CampoMascota,
  type DestinoReminder,
} from "./actions";

// Una fila por mascota, o por cliente si no tiene mascotas cargadas (en ese caso
// setup y status se guardan en el Cliente).
export type FilaReminder = {
  key: string;
  destino: DestinoReminder;
  id: number; // id de la Mascota o del Cliente, según `destino`
  cliente: string;
  mascota: string | null;
  tipo: TipoMascota | null;
  raza: string | null;
  tieneEmail: boolean; // el cliente tiene email cargado
  ultimaVentaId: number | null;
  ultimaVentaFecha: string | null; // YYYY-MM-DD
  setupReminderDias: number;
  statusReminder: StatusReminder;
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
// Si pasaron más de 30 días desde la última compra, el 1° del mes siguiente a hoy.
function calcularProximo(hoy: string, dias: string, diasTranscurridos: number | null) {
  if (diasTranscurridos === null) return null;
  if (diasTranscurridos > 30) {
    const [anio, mes] = hoy.split("-").map(Number);
    return new Date(Date.UTC(anio, mes, 1, 12)); // `mes` es 1-based, como índice 0-based es el mes siguiente
  }
  const n = Number.parseInt(dias, 10);
  if (!Number.isFinite(n)) return null;
  return new Date(aFecha(hoy).getTime() + (n - diasTranscurridos) * DIA_MS);
}

// Texto editable inline (Mascota y Raza): guarda al salir del campo o con Enter.
// `obligatorio`: si queda vacío vuelve al último valor guardado.
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

function Fila({ fila, hoy }: { fila: FilaReminder; hoy: string }) {
  const [dias, setDias] = useState(fila.setupReminderDias.toString());
  const [status, setStatus] = useState(fila.statusReminder);
  // Si el status cambia desde el server (p. ej. el switch "Todo Activo/Pausado"), sincronizar el select.
  const [statusServer, setStatusServer] = useState(fila.statusReminder);
  if (fila.statusReminder !== statusServer) {
    setStatusServer(fila.statusReminder);
    setStatus(fila.statusReminder);
  }
  const [pending, startTransition] = useTransition();
  const diasTranscurridos = calcularDiasTranscurridos(fila.ultimaVentaFecha, hoy);
  const proximo = calcularProximo(hoy, dias, diasTranscurridos);
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

  return (
    <tr className={`hover:bg-gray-50 ${pending ? "opacity-60" : ""}`}>
      <td className="px-3 py-2 font-medium">{fila.cliente}</td>
      <td className="px-3 py-2 text-gray-600">
        {esMascota ? (
          <TextoEditable guardado={fila.mascota ?? ""} obligatorio onGuardar={(v) => editarMascota("nombre", v)} />
        ) : (
          "-"
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
          "-"
        )}
      </td>
      <td className="px-3 py-2 text-gray-600">
        {esMascota ? (
          <TextoEditable guardado={fila.raza ?? ""} onGuardar={(v) => editarMascota("raza", v)} />
        ) : (
          "-"
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
      <td className="px-3 py-2 text-gray-600">{diasTranscurridos ?? "-"}</td>
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
      <td className="px-3 py-2">
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
      </td>
    </tr>
  );
}

// `hoy` (YYYY-MM-DD, hora Argentina) viene del server para que coincida con el render del cliente.
export function RemindersTabla({ filas, hoy }: { filas: FilaReminder[]; hoy: string }) {
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
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filas.map((f) => (
            <Fila key={f.key} fila={f} hoy={hoy} />
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={11} className="px-3 py-6 text-center text-gray-400">
                No hay clientes cargados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
