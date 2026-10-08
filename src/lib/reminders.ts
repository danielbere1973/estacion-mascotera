import { prisma } from "@/lib/prisma";
import { enviarMailsIndividuales, escaparHtml } from "@/lib/mail";
import { DIAS_ENTRE_REMINDERS } from "@/lib/reminders-reglas";

const DIA_MS = 24 * 60 * 60 * 1000;
const diaArgentina = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

// Días entre dos fechas contando días calendario en Argentina (igual que la columna "Días transcurridos").
function diasEntre(desde: Date, hasta: Date) {
  const a = new Date(`${diaArgentina.format(desde)}T12:00:00Z`).getTime();
  const b = new Date(`${diaArgentina.format(hasta)}T12:00:00Z`).getTime();
  return Math.round((b - a) / DIA_MS);
}

export type ClienteReminder = { id: number; nombre: string; apellido: string; email: string; dias: number };

// Clientes a los que corresponde enviar el reminder: Status Activo (en alguna de sus
// mascotas, o en el cliente si no tiene mascotas) y más días desde la última compra que su
// Setup reminder (si tiene varias mascotas activas, el menor de sus Setup), y sin reminder
// enviado en los últimos DIAS_ENTRE_REMINDERS días (haya vuelto a comprar o no).
// `sinEmail` son los que cumplen las condiciones pero no tienen email cargado.
export async function clientesParaReminder() {
  const clientes = await prisma.cliente.findMany({
    orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      statusReminder: true,
      setupReminderDias: true,
      fechaUltimoReminder: true,
      mascotas: { select: { statusReminder: true, setupReminderDias: true } },
      ventas: { orderBy: { fechaVenta: "desc" }, take: 1, select: { fechaVenta: true } },
    },
  });

  const hoy = new Date();
  const elegibles: ClienteReminder[] = [];
  const sinEmail: { id: number; nombre: string; apellido: string }[] = [];
  for (const c of clientes) {
    // Setup de lo que está activo: las mascotas activas, o el cliente si no tiene mascotas.
    const setups =
      c.mascotas.length > 0
        ? c.mascotas.filter((m) => m.statusReminder === "ACTIVO").map((m) => m.setupReminderDias)
        : c.statusReminder === "ACTIVO"
          ? [c.setupReminderDias]
          : [];
    const ultimaVenta = c.ventas[0];
    if (setups.length === 0 || !ultimaVenta) continue;
    const dias = diasEntre(ultimaVenta.fechaVenta, hoy);
    if (dias <= Math.min(...setups)) continue;
    // Mientras no vuelva a comprar recibe un reminder cada DIAS_ENTRE_REMINDERS días, nunca antes.
    if (c.fechaUltimoReminder && diasEntre(c.fechaUltimoReminder, hoy) < DIAS_ENTRE_REMINDERS) continue;
    const email = c.email?.trim();
    if (email) elegibles.push({ id: c.id, nombre: c.nombre, apellido: c.apellido, email, dias });
    else sinEmail.push({ id: c.id, nombre: c.nombre, apellido: c.apellido });
  }
  return { elegibles, sinEmail };
}

export function asuntoReminder(nombre: string) {
  return `${nombre}, ¿cómo está tu compañero? 🐾`;
}

// Banner del encabezado (public/mail/reminder-banner.png). Va con URL absoluta porque
// los clientes de mail no resuelven rutas relativas; .png queda fuera del middleware de login.
const BANNER_URL = "https://estacionmascotera.vercel.app/mail/reminder-banner.png";

export function htmlReminder(nombre: string) {
  const n = escaparHtml(nombre);
  const link = (href: string, texto: string) =>
    `<a href="${href}" style="color: #2563eb; text-decoration: underline;">${texto}</a>`;
  return `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222; max-width: 600px;">
<img src="${BANNER_URL}" width="600" alt="¡Te extrañamos! Estación Mascotera" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; margin: 0 0 16px;">
<p>Hola ${n},</p>
<p>¡Te extrañamos en Estación Mascotera! Esperamos que vos y tu mascota estén muy bien.</p>
<p>Pasó un tiempito desde tu último pedido y quisimos escribirte para saber cómo andan. ¿Todavía le queda alimento? Si se le está por terminar, avisanos y te lo reponemos, así no tenés que preocuparte por nada.</p>
<p>Si necesitás otra cosa, como snacks, piedras sanitarias, un juguete nuevo o simplemente un consejo sobre su alimentación o su cuidado, también estamos para ayudarte. Cada mascota es única y nos encanta acompañarte a cuidarla.</p>
<p>Podés hacer tu pedido como te quede más cómodo:<br>
🛒 En nuestra web: ${link("https://www.estacionmascotera.com.ar", "www.estacionmascotera.com.ar")}<br>
💬 Por WhatsApp: ${link("https://wa.me/5491173711835", "+54 911 7371 1835")}</p>
<p>Y para enterarte de promos y novedades, seguinos en Instagram (${link("https://www.instagram.com/estacion_mascotera_petshop", "@estacion_mascotera_petshop")}) y en Facebook (${link("https://www.facebook.com/share/1D7n34Hxtp/?mibextid=wwXIfr", "Estación Mascotera")}).</p>
<p>¡Mandale un mimo a tu mascota de nuestra parte!</p>
<p>Un abrazo,<br>
El equipo de Estación Mascotera 🐶🐱</p>
</div>`;
}

export type ResultadoEnvioReminders = { enviados: number; errores: number; sinEmail: number };

// Envía el mail de reminder, uno por cliente, a los que cumplen las condiciones (ver
// clientesParaReminder). Cada envío queda en el Event log. `usuarioId` null = envío automático
// (cron); en ese caso los clientes sin email solo se cuentan en el resumen, para no repetir
// una línea de error por cliente todos los días.
export async function ejecutarEnvioReminders(usuarioId: number | null): Promise<ResultadoEnvioReminders> {
  const automatico = usuarioId === null;
  const { elegibles, sinEmail } = await clientesParaReminder();

  const resultados = await enviarMailsIndividuales(
    elegibles.map((c) => ({ to: c.email, subject: asuntoReminder(c.nombre), html: htmlReminder(c.nombre) })),
  );

  const eventos = [
    ...elegibles.map((c, i) => ({
      detalle: `${c.nombre} ${c.apellido} <${c.email}> (${c.dias} días desde la última compra)`,
      resultado: resultados[i] ? `Error: ${resultados[i]}` : "OK",
    })),
    ...(automatico
      ? []
      : sinEmail.map((c) => ({ detalle: `${c.nombre} ${c.apellido}`, resultado: "Error: el cliente no tiene email" }))),
  ];
  try {
    await prisma.logMarketing.createMany({
      data: eventos.map((e) => ({ usuarioId, accion: "Envío de reminder", ...e })),
    });
  } catch (e) {
    console.error("No se pudieron registrar los envíos de reminders", e);
  }

  // Fecha del último reminder enviado OK, para la columna "Reminder enviado".
  try {
    await prisma.cliente.updateMany({
      where: { id: { in: elegibles.filter((_, i) => resultados[i] === null).map((c) => c.id) } },
      data: { fechaUltimoReminder: new Date() },
    });
  } catch (e) {
    console.error("No se pudo guardar la fecha del último reminder", e);
  }

  const enviados = resultados.filter((r) => r === null).length;
  const errores = elegibles.length - enviados;
  try {
    await prisma.logMarketing.create({
      data: {
        usuarioId,
        accion: "Envío de reminders",
        detalle: `${automatico ? "Automático: " : ""}${enviados} enviados, ${errores} con error, ${sinEmail.length} sin email`,
        resultado: errores === 0 ? "OK" : `Error: ${errores} envíos fallaron`,
      },
    });
  } catch (e) {
    console.error("No se pudo registrar el evento de Marketing", e);
  }
  return { enviados, errores, sinEmail: sinEmail.length };
}
