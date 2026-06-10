"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

export function GastosPieChart({
  data,
}: {
  data: { categoria: string; monto: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-gray-400">
        No hay gastos registrados en este período.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="monto"
          nameKey="categoria"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={(entry) => (entry as unknown as { categoria: string }).categoria}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
