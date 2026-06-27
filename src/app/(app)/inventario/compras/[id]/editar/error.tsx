"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 py-10 text-center">
      <p className="text-red-600 font-semibold">Error al guardar</p>
      <p className="text-sm text-gray-600">{error.message}</p>
      <button onClick={reset} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
        Volver al formulario
      </button>
    </div>
  );
}
