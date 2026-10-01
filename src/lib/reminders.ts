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

export const ASUNTO_REMINDER = "Tu mascota necesita alimento ?";

export function htmlReminder(nombre: string) {
  return `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #222;">
<p>Hola ${escaparHtml(nombre)}, esperamos que vos y tu mascota se encuentren muy bien. Desde Estación Mascotera vemos que hace tiempo realizaste tu último pedido por lo que queríamos saber si tu mascota cuenta con alimento, precisas que te repongamos el mismo, algún otro producto o simplemente cualquier asesoramiento que precises, sepas que contas con nosotros.</p>
<p>&nbsp;</p>
<p>Podes realizar tu pedido desde nuestro portal <a href="https://www.estacionmascotera.com.ar">www.estacionmascotera.com.ar</a> o bien contactanos por WhatsApp: <a href="https://wa.me/5491173711835">+54 911 7371 1835</a>. También nos podes ubicar en nuestras redes: IG: <a href="https://www.instagram.com/estacion_mascotera_petshop">@estacion_mascotera_petshop</a> y Facebook: Estacion Mascotera</p>
</div>`;
}
