"use client";

import { useSearchParams } from "next/navigation";

export function ExportButton() {
  const params = useSearchParams();

  function handleExport() {
    const sp = new URLSearchParams(params.toString());
    window.location.href = `/api/reportes/export?${sp.toString()}`;
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
    >
      Exportar Excel
    </button>
  );
}
