"use client";

import { useActionState } from "react";
import { resolverPendienteManualAction } from "./actions";

export function ResolverBtn({ pendienteId }: { pendienteId: number }) {
  const [state, action, pending] = useActionState(resolverPendienteManualAction, { error: null });

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="pendienteId" value={pendienteId} />
        <button
          type="submit"
          disabled={pending}
          className="text-xs text-green-600 hover:text-green-800 hover:underline disabled:opacity-40"
        >
          {pending ? "..." : "✅ Ya lo compré por fuera"}
        </button>
      </form>
      {state.error && (
        <p className="max-w-[220px] text-right text-xs text-red-600">{state.error}</p>
      )}
    </div>
  );
}
