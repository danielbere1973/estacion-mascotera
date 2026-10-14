"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { INTERVALO_ACTUALIZACION_MS, type EstadoSeguimiento } from "@/lib/seguimiento";

const MapaUbicacion = dynamic(
  () => import("@/components/mapa-ubicacion").then((m) => m.MapaUbicacion),
  { ssr: false }
);

interface Datos {
  estado: EstadoSeguimiento;
  latitud?: number | null;
  longitud?: number | null;
  precision?: number | null;
  ubicacionAt?: string | null;
}

function haceCuanto(fecha: string, ahora: number) {
  const seg = Math.max(0, Math.round((ahora - new Date(fecha).getTime()) / 1000));
  if (seg < 60) return `hace ${seg} segundos`;
  const min = Math.floor(seg / 60);
  return min === 1 ? "hace 1 minuto" : `hace ${min} minutos`;
}

export function VistaSeguimiento({ token, inicial }: { token: string; inicial: Datos }) {
  const [datos, setDatos] = useState<Datos>(inicial);
  const [ahora, setAhora] = useState(() => Date.now());
  const activo = datos.estado === "ACTIVO";

  useEffect(() => {
    if (!activo) return;
    const consultar = async () => {
      try {
        const r = await fetch(`/api/seguimiento/${token}`, { cache: "no-store" });
        if (r.ok) setDatos(await r.json());
      } catch {
        // Sin conexión momentánea: se reintenta en el próximo ciclo.
      }
    };
    const intervalo = setInterval(consultar, INTERVALO_ACTUALIZACION_MS);
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    const alVolver = () => document.visibilityState === "visible" && consultar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(intervalo);
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [activo, token]);

  const hayPosicion = activo && datos.latitud != null && datos.longitud != null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Image src="/logo.png" alt="Estación Mascotera" width={36} height={36} className="rounded-full" />
        <div>
          <p className="text-sm font-bold text-gray-900">Estación Mascotera</p>
          <p className="text-xs text-gray-500">Tu pedido está en marcha, seguí la ubicación del mismo</p>
        </div>
      </header>

      {hayPosicion ? (
        <>
          <div className="bg-white px-4 py-2 text-sm text-gray-700">
            🟢 En vivo
            {datos.ubicacionAt && (
              <span className="text-gray-500"> · actualizado {haceCuanto(datos.ubicacionAt, ahora)}</span>
            )}
          </div>
          <MapaUbicacion
            latitud={datos.latitud!}
            longitud={datos.longitud!}
            precision={datos.precision}
            className="min-h-[60dvh] w-full flex-1"
          />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div className="space-y-2">
            <p className="text-4xl">🐾</p>
            <p className="font-semibold text-gray-900">El seguimiento finalizó</p>
            <p className="text-sm text-gray-500">
              Este link ya no muestra la ubicación. Si necesitás algo, escribinos por WhatsApp.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
