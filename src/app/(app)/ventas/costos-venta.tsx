"use client";

import { useState } from "react";

type CostoRow = {
  key: number;
  concepto: string;
  modo: "MONTO" | "PORCENTAJE";
  valor: string;
  incluyeEnvio: boolean;
};

export type CostoInicial = {
  concepto: string;
  esPorcentaje: boolean;
  valor: string;
  incluyeEnvio: boolean;
};

export function CostosVenta({ costosIniciales = [] }: { costosIniciales?: CostoInicial[] }) {
  const [rows, setRows] = useState<CostoRow[]>(
    costosIniciales.map((c, i) => ({
      key: i,
      concepto: c.concepto,
      modo: c.esPorcentaje ? "PORCENTAJE" : "MONTO",
      valor: c.valor,
      incluyeEnvio: c.incluyeEnvio,
    }))
  );
  const [nextKey, setNextKey] = useState(costosIniciales.length);

  const addRow = () => {
    setRows((r) => [...r, { key: nextKey, concepto: "", modo: "MONTO", valor: "", incluyeEnvio: false }]);
    setNextKey((k) => k + 1);
  };
  const removeRow = (key: number) => setRows((r) => r.filter((row) => row.key !== key));
  const updateRow = (key: number, changes: Partial<CostoRow>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...changes } : row)));

  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">Costos de cobranza</label>
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          + Agregar costo
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Comisiones del medio de pago: gestión de cobro, comisión de venta (ej. Mercado Libre), financiación, etc. Se descuentan de la ganancia.
      </p>

      {rows.map((row) => (
        <div key={row.key} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2">
          <input
            type="text"
            value={row.concepto}
            onChange={(e) => updateRow(row.key, { concepto: e.target.value })}
            placeholder="Concepto (ej: Comisión Mercado Libre)"
            className="min-w-[200px] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input type="hidden" name="costoConcepto" value={row.concepto} />

          <select
            value={row.modo}
            onChange={(e) => updateRow(row.key, { modo: e.target.value as "MONTO" | "PORCENTAJE" })}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="MONTO">$</option>
            <option value="PORCENTAJE">%</option>
          </select>
          <input type="hidden" name="costoModo" value={row.modo} />

          <input
            type="number"
            min={0}
            step="0.01"
            value={row.valor}
            onChange={(e) => updateRow(row.key, { valor: e.target.value })}
            placeholder={row.modo === "PORCENTAJE" ? "%" : "$"}
            className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input type="hidden" name="costoValor" value={row.valor} />

          {row.modo === "PORCENTAJE" && (
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={row.incluyeEnvio}
                onChange={(e) => updateRow(row.key, { incluyeEnvio: e.target.checked })}
              />
              Incluye envío en la base
            </label>
          )}
          <input type="hidden" name="costoIncluyeEnvio" value={row.modo === "PORCENTAJE" && row.incluyeEnvio ? "on" : ""} />

          <button
            type="button"
            onClick={() => removeRow(row.key)}
            className="rounded-md px-2 py-1.5 text-sm text-red-500 hover:bg-red-50"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
