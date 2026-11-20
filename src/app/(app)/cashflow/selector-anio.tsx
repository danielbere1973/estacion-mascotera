"use client";

import { useRouter } from "next/navigation";

export function SelectorAnio({ anios, anio }: { anios: number[]; anio: number }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      Año
      <select
        value={anio}
        onChange={(e) => router.push(`/cashflow?anio=${e.target.value}`)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-900"
      >
        {anios.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </label>
  );
}
