"use client";

import { useActionState } from "react";
import { desvincularItem } from "./actions";

export function DesvincularBtn({ historialId }: { historialId: number }) {
  const [state, action, pending] = useActionState(desvincularItem, { error: null });

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="historialId" value={historialId} />
        <button
          type="submit"
          disabled={pending}
          className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-40"
        >
          {pending ? "..." : "Desvincular"}
        </button>
      </form>
      {state.error && (
        <p className="max-w-[220px] text-right text-xs text-red-600">{state.error}</p>
      )}
    </div>
  );
}
