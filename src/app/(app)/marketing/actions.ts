"use server";

import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/permissions";

// Resend solo permite enviar "from" un dominio verificado.
const FROM_ADDRESS = "Estación Mascotera <no-reply@estacionmascotera.com.ar>";

// Remitente fijo: recibe la copia de confirmación y es el "Reply-To" de
// todas las campañas. No es configurable desde el formulario a propósito.
const REMITENTE_FIJO = "contacto@estacionmascotera.com.ar";

export async function subirImagenMail(formData: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin();

  const archivo = formData.get("file");
  if (!(archivo instanceof File)) {
    return { error: "Archivo inválido." };
  }
  if (!archivo.type.startsWith("image/")) {
    return { error: "Solo se pueden subir imágenes." };
  }

  try {
    const blob = await put(`marketing/${archivo.name}`, archivo, {
      access: "public",
      addRandomSuffix: true,
    });
    return { url: blob.url };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error desconocido al subir la imagen.",
    };
  }
}

export async function enviarCampania({
  titulo,
  cuerpoHtml,
  destinatarios,
}: {
  titulo: string;
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
        to: [REMITENTE_FIJO],
        bcc: destinatarios,
        reply_to: REMITENTE_FIJO,
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
