import { prisma } from "@/lib/prisma";
import { escaparHtml } from "@/lib/mail";

const DIA_MS = 24 * 60 * 60 * 1000;
const diaArgentina = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

// Días entre dos fechas contando días calendario en Argentina (igual que la columna "Días transcurridos").
function diasEntre(desde: Date, hasta: Date) {
  const a = new Date(`${diaArgentina.format(desde)}T12:00:00Z`).getTime();
  const b = new Date(`${diaArgentina.format(hasta)}T12:00:00Z`).getTime();
  return Math.round((b - a) / DIA_MS);
}

export const DIAS_MINIMOS_REMINDER = 30;

export type ClienteReminder = { id: number; nombre: string; apellido: string; email: string; dias: number };

// Clientes a los que corresponde enviar el reminder: Status Activo (en alguna de sus
// mascotas, o en el cliente si no tiene mascotas) y más de 30 días desde la última compra.
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
      mascotas: { select: { statusReminder: true } },
      ventas: { orderBy: { fechaVenta: "desc" }, take: 1, select: { fechaVenta: true } },
    },
  });

  const hoy = new Date();
  const elegibles: ClienteReminder[] = [];
  const sinEmail: { id: number; nombre: string; apellido: string }[] = [];
  for (const c of clientes) {
    const activo =
      c.mascotas.length > 0 ? c.mascotas.some((m) => m.statusReminder === "ACTIVO") : c.statusReminder === "ACTIVO";
    const ultimaVenta = c.ventas[0];
    if (!activo || !ultimaVenta) continue;
    const dias = diasEntre(ultimaVenta.fechaVenta, hoy);
    if (dias <= DIAS_MINIMOS_REMINDER) continue;
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
