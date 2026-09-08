"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions";
import { resolverPendienteManual } from "@/lib/compras-mayoristas";

export async function resolverPendienteManualAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  await requireAdmin();
  const pendienteId = Number(formData.get("pendienteId"));
  if (!pendienteId) return { error: "Datos inválidos." };

  await resolverPendienteManual(pendienteId);

  revalidatePath("/inventario/pendientes-hym");
  return { error: null };
}
