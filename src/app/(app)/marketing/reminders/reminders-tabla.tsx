"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatDate } from "@/lib/format";
import type { StatusReminder } from "@prisma/client";
import { actualizarSetupReminder, actualizarStatusReminder } from "./actions";

type FilaBase = {
  key: string;
  cliente: string;
  raza: string | null;
  ultimaVentaId: number | null;
  ultimaVentaFecha: string | null; // YYYY-MM-DD
};

type FilaMascota = FilaBase & {
  mascotaId: number;
  mascota: string;
  tipo: string;
  setupReminderDias: number;
  statusReminder: StatusReminder;
};

// Cliente sin mascotas cargadas: sin datos de mascota ni setup/status.
type FilaClienteSinMascota = FilaBase & {
  mascotaId: null;
  mascota: null;
  tipo: null;
  setupReminderDias: null;
  statusReminder: null;
};

export type FilaReminder = FilaMascota | FilaClienteSinMascota;

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

// Última compra, Fecha última compra y Días transcurridos (comunes a ambos tipos de fila).
function CeldasUltimaCompra({ fila, diasTranscurridos }: { fila: FilaBase; diasTranscurridos: number | null }) {
  return (
    <>
      <td className="px-3 py-2 text-gray-600">
        {fila.ultimaVentaId ? (
          <Link href={`/ventas/${fila.ultimaVentaId}/editar`} className="text-blue-600 hover:underline">
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
    </>
  );
}

function FilaClienteSinMascota({ fila, hoy }: { fila: FilaClienteSinMascota; hoy: string }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-2 font-medium">{fila.cliente}</td>
      <td className="px-3 py-2 text-gray-400">-</td>
      <td className="px-3 py-2 text-gray-400">-</td>
      <td className="px-3 py-2 text-gray-400">-</td>
      <CeldasUltimaCompra fila={fila} diasTranscurridos={calcularDiasTranscurridos(fila.ultimaVentaFecha, hoy)} />
      <td className="px-3 py-2 text-gray-400">-</td>
      <td className="px-3 py-2 text-gray-400">-</td>
      <td className="px-3 py-2 text-gray-400">-</td>
    </tr>
  );
}

function Fila({ fila, hoy }: { fila: FilaMascota; hoy: string }) {
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

  return (
    <tr className={`hover:bg-gray-50 ${pending ? "opacity-60" : ""}`}>
      <td className="px-3 py-2 font-medium">{fila.cliente}</td>
      <td className="px-3 py-2 text-gray-600">{fila.mascota}</td>
      <td className="px-3 py-2 text-gray-600">{fila.tipo}</td>
      <td className="px-3 py-2 text-gray-600">{fila.raza ?? "-"}</td>
      <CeldasUltimaCompra fila={fila} diasTranscurridos={diasTranscurridos} />
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
              startTransition(() => actualizarSetupReminder(fila.mascotaId, n.toString()));
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
            startTransition(() => actualizarStatusReminder(fila.mascotaId, e.target.value));
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
            f.mascotaId === null ? (
              <FilaClienteSinMascota key={f.key} fila={f} hoy={hoy} />
            ) : (
              <Fila key={f.key} fila={f} hoy={hoy} />
            )
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-6 text-center text-gray-400">
                No hay clientes cargados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
