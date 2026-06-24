"use client";

import { useState } from "react";

export function FacturadoField({ defaultFacturado = false, defaultNumero = "" }: { defaultFacturado?: boolean; defaultNumero?: string }) {
  const [facturado, setFacturado] = useState(defaultFacturado);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          name="facturado"
          className="h-4 w-4"
          checked={facturado}
          onChange={(e) => setFacturado(e.target.checked)}
        />
        Facturado
      </label>
      <input
        name="numeroFactura"
        placeholder="N° de factura"
        defaultValue={defaultNumero}
        disabled={!facturado}
        className={`w-full rounded-md border px-3 py-2 text-sm transition-colors ${
          facturado
            ? "border-gray-300 bg-white text-gray-900"
            : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
        }`}
      />
    </div>
  );
}
