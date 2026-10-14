"use client";

import { useEffect, useRef } from "react";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

// Mapa de OpenStreetMap (sin API key) con un punto que se mueve cuando cambian
// las coordenadas. Leaflet toca `window` al importarse, por eso se carga
// dinámicamente dentro del efecto y no en el import de arriba.
export function MapaUbicacion({
  latitud,
  longitud,
  precision,
  className,
}: {
  latitud: number;
  longitud: number;
  precision?: number | null;
  className?: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<LeafletMap | null>(null);
  const marcadorRef = useRef<Marker | null>(null);
  const circuloRef = useRef<Circle | null>(null);
  const posicionRef = useRef({ latitud, longitud, precision });

  useEffect(() => {
    let cancelado = false;
    import("leaflet").then((L) => {
      if (cancelado || !contenedorRef.current || mapaRef.current) return;
      const { latitud, longitud, precision } = posicionRef.current;
      const mapa = L.map(contenedorRef.current).setView([latitud, longitud], 16);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);
      // divIcon con el logo en vez del ícono por defecto: el default de Leaflet
      // referencia imágenes por ruta relativa que el bundler no resuelve. El
      // logo es un círculo dentro de una imagen vertical, por eso va recortado
      // con background-size: cover centrado.
      const icono = L.divIcon({
        className: "",
        html: '<div style="width:36px;height:36px;border-radius:9999px;background:#fff url(/logo.png) center/cover no-repeat;box-shadow:0 0 0 2px rgba(37,99,235,.45),0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      marcadorRef.current = L.marker([latitud, longitud], { icon: icono }).addTo(mapa);
      circuloRef.current = L.circle([latitud, longitud], {
        radius: precision ?? 0,
        color: "#2563eb",
        weight: 1,
        fillOpacity: 0.1,
      }).addTo(mapa);
      mapaRef.current = mapa;
    });
    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, []);

  useEffect(() => {
    posicionRef.current = { latitud, longitud, precision };
    const mapa = mapaRef.current;
    if (!mapa) return;
    marcadorRef.current?.setLatLng([latitud, longitud]);
    circuloRef.current?.setLatLng([latitud, longitud]).setRadius(precision ?? 0);
    mapa.panTo([latitud, longitud]);
  }, [latitud, longitud, precision]);

  return <div ref={contenedorRef} className={`relative isolate z-0 ${className ?? ""}`} />;
}
