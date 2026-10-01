"use client";

import { useState, useTransition } from "react";
import { formatDate } from "@/lib/format";
import { actualizarSetupReminder, actualizarUltimoReminder } from "./actions";

export type FilaReminder = {
  mascotaId: number;
  cliente: string;
  mascota: string;
  tipo: string;
  raza: string | null;
  ultimaVentaId: number | null;
  ultimaVentaFecha: string | null; // YYYY-MM-DD
  ultimoReminder: string | null; // YYYY-MM-DD
  setupReminderDias: number | null;
};

const DIA_MS = 24 * 60 * 60 * 1000;

// Próximo = último reminder + días; si todavía no hubo reminder, parte de la
// fecha de la última compra.
function calcularProximo(ultimoReminder: string, ultimaVentaFecha: string | null, dias: string) {
  const base = ultimoReminder || ultimaVentaFecha;
  const n = Number.parseInt(dias, 10);
  if (!base || !Number.isFinite(n)) return null;
  return new Date(new Date(`${base}T12:00:00Z`).getTime() + n * DIA_MS);
}

function Fila({ fila }: { fila: FilaReminder }) {
  const [ultimo, setUltimo] = useState(fila.ultimoReminder ?? "");
  const [dias, setDias] = useState(fila.setupReminderDias?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const proximo = calcularProximo(ultimo, fila.ultimaVentaFecha, dias);

  return (
    <tr className={`hover:bg-gray-50 ${pending ? "opacity-60" : ""}`}>
      <td className="px-3 py-2 font-medium">{fila.cliente}</td>
      <td className="px-3 py-2 text-gray-600">{fila.mascota}</td>
      <td className="px-3 py-2 text-gray-600">{fila.tipo}</td>
      <td className="px-3 py-2 text-gray-600">{fila.raza ?? "-"}</td>
      <td className="px-3 py-2 text-gray-600">{fila.ultimaVentaId ? `#${fila.ultimaVentaId}` : "-"}</td>
      <td className="px-3 py-2">
        <input
          type="date"
          value={ultimo}
          onChange={(e) => {
            setUltimo(e.target.value);
            startTransition(() => actualizarUltimoReminder(fila.mascotaId, e.target.value));
          }}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2 text-gray-600">{proximo ? formatDate(proximo) : "-"}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          value={dias}
          onChange={(e) => setDias(e.target.value)}
          onBlur={() => {
            if (dias !== (fila.setupReminderDias?.toString() ?? "")) {
              startTransition(() => actualizarSetupReminder(fila.mascotaId, dias));
            }
          }}
          placeholder="días"
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
      </td>
    </tr>
  );
}

export function RemindersTabla({ filas }: { filas: FilaReminder[] }) {
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
            <th className="px-3 py-2">Último reminder</th>
            <th className="px-3 py-2">Próximo reminder</th>
            <th className="px-3 py-2">Setup reminder</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filas.map((f) => (
            <Fila key={f.mascotaId} fila={f} />
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                No hay mascotas cargadas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
