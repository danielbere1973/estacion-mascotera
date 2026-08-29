"use server";

import { requireAdmin } from "@/lib/permissions";

// Resend solo permite enviar "from" un dominio verificado. El campo
// "Remitente" del formulario se usa como destinatario de la copia de
// confirmación y como "Reply-To": si el cliente contesta, la respuesta
// llega a esa casilla.
const FROM_ADDRESS = "Estación Mascotera <no-reply@estacionmascotera.com.ar>";

export async function enviarCampania({
  titulo,
  remitente,
  cuerpoHtml,
  destinatarios,
}: {
  titulo: string;
  remitente: string;
  cuerpoHtml: string;
  destinatarios: string[];
}): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();

  if (!process.env.RESEND_API_KEY) {
    return { error: "Falta configurar RESEND_API_KEY en el servidor." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [remitente],
        bcc: destinatarios,
        reply_to: remitente,
        subject: titulo,
        html: cuerpoHtml,
      }),
    });

    if (!res.ok) {
      const detalle = await res.text();
      return { error: `Resend devolvió un error: ${detalle}` };
    }

    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error desconocido al enviar el mail.",
    };
  }
}
