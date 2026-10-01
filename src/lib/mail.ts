// Envío de mails vía Resend, compartido por Campañas y Reminders.

// Resend solo permite enviar "from" un dominio verificado.
export const FROM_ADDRESS = "Estación Mascotera <no-reply@estacionmascotera.com.ar>";

// Remitente fijo: recibe la copia de confirmación y es el "Reply-To" de
// todas las campañas. No es configurable desde el formulario a propósito.
export const REMITENTE_FIJO = "contacto@estacionmascotera.com.ar";

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type MailIndividual = { to: string; subject: string; html: string };

// Resend acepta hasta 100 mails por llamada al endpoint batch.
const TAMANIO_LOTE = 100;

// Envía un mail por destinatario (cada uno con su propio "to"), en lotes.
// Devuelve, en el mismo orden, null si salió bien o el mensaje de error.
export async function enviarMailsIndividuales(mails: MailIndividual[]): Promise<(string | null)[]> {
  if (!process.env.RESEND_API_KEY) return mails.map(() => "Falta configurar RESEND_API_KEY en el servidor.");

  const resultados: (string | null)[] = [];
  for (let i = 0; i < mails.length; i += TAMANIO_LOTE) {
    const lote = mails.slice(i, i + TAMANIO_LOTE);
    let error: string | null = null;
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          lote.map((m) => ({
            from: FROM_ADDRESS,
            to: [m.to],
            reply_to: REMITENTE_FIJO,
            subject: m.subject,
            html: m.html,
          })),
        ),
      });
      if (!res.ok) error = `Resend devolvió un error: ${await res.text()}`;
    } catch (e) {
      error = e instanceof Error ? e.message : "Error desconocido al enviar el mail.";
    }
    resultados.push(...lote.map(() => error));
    // Respetar el límite de requests por segundo de Resend entre lotes.
    if (i + TAMANIO_LOTE < mails.length) await new Promise((r) => setTimeout(r, 600));
  }
  return resultados;
}
