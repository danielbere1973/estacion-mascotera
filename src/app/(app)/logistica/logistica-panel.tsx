"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Combobox } from "@/components/combobox";
import { INTERVALO_ACTUALIZACION_MS } from "@/lib/seguimiento";
import {
  actualizarUbicacion,
  finalizarSeguimiento,
  iniciarSeguimiento,
  listarSeguimientosActivos,
} from "./actions";

const MapaUbicacion = dynamic(
  () => import("@/components/mapa-ubicacion").then((m) => m.MapaUbicacion),
  { ssr: false }
);

const MapaSeguimientos = dynamic(
  () => import("@/components/mapa-seguimientos").then((m) => m.MapaSeguimientos),
  { ssr: false }
);

// Si un celular no manda posición hace más de esto (pantalla bloqueada, sin
// señal), se marca en gris en el mapa general.
const SIN_SENAL_MS = 2 * 60 * 1000;
const COLOR_PROPIO = "#2563eb";
const COLOR_SIN_SENAL = "#9ca3af";
const COLORES_EQUIPO = ["#16a34a", "#ea580c", "#9333ea", "#db2777"];

interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  telefono: string;
}

interface Seguimiento {
  id: number;
  token: string;
  usuarioId: number;
  latitud: number | null;
  longitud: number | null;
  precision: number | null;
  ubicacionAt: Date | null;
  venceAt: Date;
  cliente: { nombre: string; apellido: string; telefono: string };
  usuario: { nombre: string; apellido: string };
}

type Posicion = { latitud: number; longitud: number; precision: number | null };

function aPosicion(p: GeolocationPosition): Posicion {
  return {
    latitud: p.coords.latitude,
    longitud: p.coords.longitude,
    precision: Number.isFinite(p.coords.accuracy) ? Math.round(p.coords.accuracy) : null,
  };
}

function mensajeErrorGeo(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "No se dio permiso para usar la ubicación. Habilitalo en la configuración del navegador (en iPhone: Ajustes → Privacidad → Localización → Safari) y volvé a intentar.";
  }
  if (error.code === error.TIMEOUT) return "Tardó demasiado en obtener la ubicación. Probá de nuevo.";
  return "No se pudo obtener la ubicación del celular. Revisá que el GPS esté activado.";
}

function obtenerPosicion() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  });
}

function haceCuanto(fecha: Date | null, ahora: number) {
  if (!fecha) return "—";
  const seg = Math.max(0, Math.round((ahora - new Date(fecha).getTime()) / 1000));
  if (seg < 60) return `hace ${seg} s`;
  return `hace ${Math.floor(seg / 60)} min`;
}

function hora(fecha: Date) {
  return new Date(fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function linkWhatsApp(telefono: string, nombre: string, url: string) {
  const texto = `Hola ${nombre}! Te compartimos nuestra ubicación en vivo para que sepas dónde estamos: ${url}\n(El link funciona durante 1 hora.)\nEstación Mascotera 🐾`;
  return `https://wa.me/${telefono.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

export function LogisticaPanel({
  clientes,
  activos,
  usuarioId,
  clienteIdInicial,
  origen,
}: {
  clientes: Cliente[];
  activos: Seguimiento[];
  usuarioId: number;
  clienteIdInicial: string;
  origen: string;
}) {
  const [clienteId, setClienteId] = useState(
    clientes.some((c) => String(c.id) === clienteIdInicial) ? clienteIdInicial : ""
  );
  const [error, setError] = useState("");
  const [iniciando, setIniciando] = useState(false);
  // Seguimiento propio en curso: el recién creado, o el que quedó activo si se
  // recargó la página (en ese caso hay que tocar "Reanudar" para retransmitir).
  const [mio, setMio] = useState<Seguimiento | null>(
    () => activos.find((s) => s.usuarioId === usuarioId) ?? null
  );
  const [transmitiendo, setTransmitiendo] = useState(false);
  const [posicion, setPosicion] = useState<Posicion | null>(() =>
    mio?.latitud != null && mio.longitud != null
      ? { latitud: mio.latitud, longitud: mio.longitud, precision: mio.precision }
      : null
  );
  const [ultimoEnvio, setUltimoEnvio] = useState<Date | null>(mio?.ubicacionAt ?? null);
  const [ahora, setAhora] = useState(() => Date.now());
  const posicionRef = useRef<Posicion | null>(posicion);
  // Lista de activos refrescada en vivo (null hasta la primera consulta: se
  // usa la que vino del servidor al cargar la página).
  const [activosVivos, setActivosVivos] = useState<Seguimiento[] | null>(null);
  const lista = activosVivos ?? activos;

  const refrescar = useCallback(async () => {
    try {
      setActivosVivos(await listarSeguimientosActivos());
    } catch {
      // Sin conexión momentánea: se reintenta en el próximo ciclo.
    }
  }, []);

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    const intervalo = setInterval(refrescar, INTERVALO_ACTUALIZACION_MS);
    const alVolver = () => document.visibilityState === "visible" && refrescar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(reloj);
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [refrescar]);

  // Mientras se transmite: seguir el GPS, mandar la última posición cada
  // INTERVALO_ACTUALIZACION_MS y pedir que la pantalla no se apague.
  useEffect(() => {
    if (!transmitiendo || !mio) return;
    const token = mio.token;
    const venceAt = new Date(mio.venceAt).getTime();
    let wakeLock: WakeLockSentinel | null = null;
    let detenido = false;

    function detener(mensaje?: string) {
      if (detenido) return;
      detenido = true;
      setTransmitiendo(false);
      setMio(null);
      if (mensaje) setError(mensaje);
      refrescar();
    }

    async function enviar() {
      const p = posicionRef.current;
      if (!p || detenido) return;
      if (Date.now() >= venceAt) return detener("El seguimiento venció (duraba 1 hora).");
      try {
        const sigueActivo = await actualizarUbicacion(token, p);
        if (!sigueActivo) return detener("El seguimiento ya no está activo.");
        setUltimoEnvio(new Date());
      } catch {
        // Sin conexión momentánea: se reintenta en el próximo ciclo.
      }
    }

    async function pedirWakeLock() {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {
        // No soportado o denegado: sigue funcionando, solo que la pantalla
        // se puede apagar sola.
      }
    }

    function alVolver() {
      if (document.visibilityState !== "visible") return;
      pedirWakeLock();
      enviar();
    }

    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        posicionRef.current = aPosicion(p);
        setPosicion(posicionRef.current);
      },
      (e) => setError(mensajeErrorGeo(e)),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    const intervalo = setInterval(enviar, INTERVALO_ACTUALIZACION_MS);
    pedirWakeLock();
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      detenido = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      wakeLock?.release().catch(() => {});
    };
  }, [transmitiendo, mio, refrescar]);

  const opcionesCliente = clientes.map((c) => ({
    value: String(c.id),
    label: `${c.nombre} ${c.apellido}`,
    search: `${c.nombre} ${c.apellido} ${c.telefono}`,
  }));
  const clienteSeleccionado = clientes.find((c) => String(c.id) === clienteId);

  async function compartir() {
    if (!clienteSeleccionado) return;
    setError("");
    if (!("geolocation" in navigator)) {
      setError("Este navegador no permite obtener la ubicación.");
      return;
    }
    setIniciando(true);
    try {
      const p = aPosicion(await obtenerPosicion());
      const nuevo = await iniciarSeguimiento(clienteSeleccionado.id, p);
      posicionRef.current = p;
      setPosicion(p);
      setUltimoEnvio(new Date());
      setMio({
        id: nuevo.id,
        token: nuevo.token,
        usuarioId,
        ...p,
        ubicacionAt: new Date(),
        venceAt: nuevo.venceAt,
        cliente: {
          nombre: clienteSeleccionado.nombre,
          apellido: clienteSeleccionado.apellido,
          telefono: clienteSeleccionado.telefono,
        },
        usuario: { nombre: "", apellido: "" },
      });
      setTransmitiendo(true);
      refrescar();
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && "PERMISSION_DENIED" in e) {
        setError(mensajeErrorGeo(e as GeolocationPositionError));
      } else {
        setError(e instanceof Error ? e.message : "No se pudo iniciar el seguimiento.");
      }
    } finally {
      setIniciando(false);
    }
  }

  async function dejarDeCompartir(id: number) {
    if (mio?.id === id) {
      setTransmitiendo(false);
      setMio(null);
    }
    await finalizarSeguimiento(id);
    refrescar();
  }

  const urlSeguimiento = mio ? `${origen}/seguimiento/${mio.token}` : "";

  // Para el propio seguimiento se usa la posición local (más fresca que la
  // última que guardó el servidor).
  const ultimaUbicacion = (s: Seguimiento) => (s.id === mio?.id ? ultimoEnvio : s.ubicacionAt);
  const sinSenal = (s: Seguimiento) => {
    const u = ultimaUbicacion(s);
    return !u || ahora - new Date(u).getTime() > SIN_SENAL_MS;
  };
  const puntosMapa = lista.flatMap((s) => {
    const propio = s.id === mio?.id && posicion;
    const latitud = propio ? posicion.latitud : s.latitud;
    const longitud = propio ? posicion.longitud : s.longitud;
    if (latitud == null || longitud == null) return [];
    const color = sinSenal(s)
      ? COLOR_SIN_SENAL
      : s.usuarioId === usuarioId
        ? COLOR_PROPIO
        : COLORES_EQUIPO[s.usuarioId % COLORES_EQUIPO.length];
    const quien = s.usuarioId === usuarioId ? "Yo" : s.usuario.nombre;
    return [{ id: s.id, latitud, longitud, color, etiqueta: `${quien} → ${s.cliente.nombre} ${s.cliente.apellido}` }];
  });
  // El mapa general se muestra cuando hay entregas de otros: si solo está la
  // propia, ya se ve en el mapa de arriba.
  const mostrarMapaGeneral = lista.some((s) => s.usuarioId !== usuarioId);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Logística</h1>

      {!mio && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="font-semibold text-gray-900">Compartir ubicación en vivo</h2>
          <p className="text-sm text-gray-500">
            El cliente recibe por WhatsApp un link donde ve en un mapa dónde estamos. Se actualiza
            cada 10 segundos mientras esta pantalla esté abierta, y vence a la hora.
          </p>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Cliente</label>
            <Combobox
              options={opcionesCliente}
              value={clienteId}
              onSelect={setClienteId}
              placeholder="Buscar cliente..."
            />
            {clienteSeleccionado && (
              <p className="text-xs text-gray-500">WhatsApp: {clienteSeleccionado.telefono}</p>
            )}
          </div>
          <button
            type="button"
            onClick={compartir}
            disabled={!clienteSeleccionado || iniciando}
            className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {iniciando ? "Obteniendo ubicación..." : "📍 Compartir ubicación con el cliente"}
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {mio && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">
                {transmitiendo ? "🟢 Compartiendo en vivo" : "⏸️ Seguimiento en pausa"} con{" "}
                {mio.cliente.nombre} {mio.cliente.apellido}
              </p>
              <p className="text-xs text-gray-500">
                Última ubicación enviada {haceCuanto(ultimoEnvio, ahora)} · vence a las{" "}
                {hora(mio.venceAt)}
              </p>
            </div>
          </div>

          {!transmitiendo && (
            <div className="space-y-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              <p>Este celular no está mandando la ubicación (se recargó la página).</p>
              <button
                type="button"
                onClick={() => setTransmitiendo(true)}
                className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Reanudar envío de ubicación
              </button>
            </div>
          )}

          {urlSeguimiento && (
            <a
              href={linkWhatsApp(mio.cliente.telefono, mio.cliente.nombre, urlSeguimiento)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-md bg-green-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-green-700"
            >
              Enviar link por WhatsApp
            </a>
          )}

          {posicion && (
            <MapaUbicacion
              latitud={posicion.latitud}
              longitud={posicion.longitud}
              precision={posicion.precision}
              className="h-72 w-full overflow-hidden rounded-lg border border-gray-200 sm:h-96"
            />
          )}

          <p className="text-xs text-gray-500">
            Dejá esta pantalla abierta: si bloqueás el celular o cambiás de app, el cliente ve la
            última ubicación enviada hasta que vuelvas.
          </p>

          <button
            type="button"
            onClick={() => dejarDeCompartir(mio.id)}
            className="w-full rounded-md bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
          >
            Dejar de compartir
          </button>
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-gray-900">Seguimientos activos</h2>
        {mostrarMapaGeneral && puntosMapa.length > 0 && (
          <>
            <MapaSeguimientos
              puntos={puntosMapa}
              className="h-72 w-full overflow-hidden rounded-lg border border-gray-200 sm:h-96"
            />
            <p className="text-xs text-gray-500">
              Este mapa es solo para el equipo: cada cliente ve únicamente la entrega que le
              compartieron. En gris, los que no mandan ubicación hace más de 2 minutos.
            </p>
          </>
        )}
        {lista.length === 0 ? (
          <p className="text-sm text-gray-400">No hay ningún seguimiento activo.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {lista.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    {s.cliente.nombre} {s.cliente.apellido}
                  </p>
                  <p className="text-xs text-gray-500">
                    Por {s.usuario.nombre} {s.usuario.apellido} · actualizado{" "}
                    {haceCuanto(ultimaUbicacion(s), ahora)}
                    {sinSenal(s) && <span className="text-amber-600"> (sin señal)</span>} · vence{" "}
                    {hora(s.venceAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={`/seguimiento/${s.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Ver como cliente
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("¿Finalizar este seguimiento? El cliente deja de ver la ubicación.")) {
                        dejarDeCompartir(s.id);
                      }
                    }}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Finalizar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
