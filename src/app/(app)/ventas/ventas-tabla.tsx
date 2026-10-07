"use client";

import { ThOrdenable, useOrden, type ValorOrden } from "@/components/orden-tabla";
import { calcularTotalesVenta, VentaExpandibleRow, type VentaRow } from "./venta-row";

type Columna = "fecha" | "cliente" | "total" | "totalAbonado" | "ganancia" | "facturado";

function valorOrden(venta: VentaRow, columna: Columna): ValorOrden {
  switch (columna) {
    case "fecha":
      return new Date(venta.fechaVenta).getTime();
    case "cliente":
      return `${venta.cliente.nombre} ${venta.cliente.apellido}`;
    case "total":
      return calcularTotalesVenta(venta).total;
    case "totalAbonado":
      return calcularTotalesVenta(venta).totalAbonado;
    case "ganancia":
      return calcularTotalesVenta(venta).ganancia;
    case "facturado":
      return venta.facturado ? "Sí" : "No";
  }
}

// Tabla de Ventas con orden por columna (sin elegir, queda por fecha descendente como viene del server).
export function VentasTabla({ ventas, esRestringido }: { ventas: VentaRow[]; esRestringido: boolean }) {
  const { ordenadas, orden, ordenar } = useOrden(ventas, valorOrden);
  const th = { orden, onOrdenar: ordenar };

  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
        <tr>
          <th className="w-8 px-3 py-2"></th>
          <ThOrdenable label="Fecha" columna="fecha" {...th} />
          <ThOrdenable label="Cliente" columna="cliente" {...th} />
          <ThOrdenable label="Total" columna="total" className="px-3 py-2 text-right" {...th} />
          <ThOrdenable label="Total abonado" columna="totalAbonado" className="px-3 py-2 text-right" {...th} />
          {!esRestringido && (
            <ThOrdenable label="Ganancia" columna="ganancia" className="px-3 py-2 text-right" {...th} />
          )}
          <ThOrdenable label="Facturado" columna="facturado" {...th} />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {ordenadas.map((venta) => (
          <VentaExpandibleRow key={venta.id} venta={venta} esRestringido={esRestringido} />
        ))}
        {ventas.length === 0 && (
          <tr>
            <td colSpan={esRestringido ? 6 : 7} className="px-3 py-8 text-center text-gray-400">
              No hay ventas registradas para este filtro.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
