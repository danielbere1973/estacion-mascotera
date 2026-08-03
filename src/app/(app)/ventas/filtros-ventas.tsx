"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const CANAL_LABELS: Record<string, string> = {
  TIENDANUBE: "Tiendanube",
  WHATSAPP: "WhatsApp",
  TELEFONO: "Teléfono",
};

function MultiSelect({
  label,
  name,
  options,
  selected,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white leading-none">
            {selected.length}
          </span>
        )}
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-[180px] rounded-md border border-gray-200 bg-white shadow-lg">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-3.5 w-3.5 rounded"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function FiltrosVentas({
  desde: defaultDesde,
  hasta: defaultHasta,
  clienteId: defaultClienteId,
  facturado: defaultFacturado,
  canalesSeleccionados: defaultCanales,
  pagosSeleccionados: defaultPagos,
  clientes,
  mediosPago,
}: {
  desde?: string;
  hasta?: string;
  clienteId?: string;
  facturado?: string;
  canalesSeleccionados: string[];
  pagosSeleccionados: string[];
  clientes: { id: number; nombre: string; apellido: string }[];
  mediosPago: string[];
}) {
  const router = useRouter();
  const [canales, setCanales] = useState<string[]>(defaultCanales);
  const [pagos, setPagos] = useState<string[]>(defaultPagos);

  const canalesOpciones = (["TIENDANUBE", "WHATSAPP", "TELEFONO"] as const).map((c) => ({
    value: c,
    label: CANAL_LABELS[c],
  }));

  const pagosOpciones = mediosPago.map((mp) => ({ value: mp, label: mp }));

  function removeCanal(v: string) { setCanales(canales.filter((c) => c !== v)); }
  function removePago(v: string) { setPagos(pagos.filter((p) => p !== v)); }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const params = new URLSearchParams();
    const desde = data.get("desde") as string;
    const hasta = data.get("hasta") as string;
    const clienteId = data.get("clienteId") as string;
    const facturado = data.get("facturado") as string;
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (clienteId) params.set("clienteId", clienteId);
    if (facturado) params.set("facturado", facturado);
    canales.forEach((c) => params.append("canal", c));
    pagos.forEach((p) => params.append("pago", p));
    router.push(`/ventas?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-3 text-sm space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="date"
          name="desde"
          defaultValue={defaultDesde}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          type="date"
          name="hasta"
          defaultValue={defaultHasta}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <select
          name="clienteId"
          defaultValue={defaultClienteId ?? ""}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.apellido}
            </option>
          ))}
        </select>
        <select
          name="facturado"
          defaultValue={defaultFacturado ?? ""}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Facturado: todos</option>
          <option value="si">Facturado: sí</option>
          <option value="no">Facturado: no</option>
        </select>

        <MultiSelect
          label="Canal"
          name="canal"
          options={canalesOpciones}
          selected={canales}
          onChange={setCanales}
        />
        <MultiSelect
          label="Pago"
          name="pago"
          options={pagosOpciones}
          selected={pagos}
          onChange={setPagos}
        />

        <button
          type="submit"
          className="rounded-md bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-900"
        >
          Filtrar
        </button>
      </div>

      {(canales.length > 0 || pagos.length > 0) && (
        <div className="flex flex-wrap gap-1.5 border-t border-gray-100 pt-2">
          {canales.map((c) => (
            <span
              key={c}
              className="flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs text-blue-700"
            >
              {CANAL_LABELS[c] ?? c}
              <button type="button" onClick={() => removeCanal(c)} className="hover:text-blue-900 font-bold">×</button>
            </span>
          ))}
          {pagos.map((p) => (
            <span
              key={p}
              className="flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs text-green-700"
            >
              {p}
              <button type="button" onClick={() => removePago(p)} className="hover:text-green-900 font-bold">×</button>
            </span>
          ))}
        </div>
      )}
    </form>
  );
}
