"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface PuntoMapa {
  id: number;
  latitud: number;
  longitud: number;
  etiqueta: string;
  color: string;
}

type Leaflet = typeof import("leaflet");

function icono(L: Leaflet, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// Mapa interno de Logística con todos los seguimientos activos a la vez, cada
// uno con su etiqueta. Reencuadra solo cuando aparece o desaparece un punto,
// para no pelear con el usuario si está moviendo el mapa a mano.
export function MapaSeguimientos({ puntos, className }: { puntos: PuntoMapa[]; className?: string }) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const marcadoresRef = useRef(new Map<number, { marker: Marker; color: string; etiqueta: string }>());
  const idsEncuadradosRef = useRef("");
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const marcadores = marcadoresRef.current;
    import("leaflet").then((L) => {
      if (cancelado || !contenedorRef.current || mapaRef.current) return;
      const mapa = L.map(contenedorRef.current).setView([-34.6037, -58.3816], 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);
      leafletRef.current = L;
      mapaRef.current = mapa;
      setListo(true);
    });
    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
      marcadores.clear();
      idsEncuadradosRef.current = "";
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const mapa = mapaRef.current;
    if (!listo || !L || !mapa) return;
    const marcadores = marcadoresRef.current;

    const vigentes = new Set(puntos.map((p) => p.id));
    for (const [id, m] of marcadores) {
      if (!vigentes.has(id)) {
        m.marker.remove();
        marcadores.delete(id);
      }
    }

    for (const p of puntos) {
      const actual = marcadores.get(p.id);
      if (!actual) {
        const marker = L.marker([p.latitud, p.longitud], { icon: icono(L, p.color) })
          .bindTooltip(p.etiqueta, { permanent: true, direction: "top", offset: [0, -10] })
          .addTo(mapa);
        marcadores.set(p.id, { marker, color: p.color, etiqueta: p.etiqueta });
        continue;
      }
      actual.marker.setLatLng([p.latitud, p.longitud]);
      if (actual.color !== p.color) {
        actual.marker.setIcon(icono(L, p.color));
        actual.color = p.color;
      }
      if (actual.etiqueta !== p.etiqueta) {
        actual.marker.setTooltipContent(p.etiqueta);
        actual.etiqueta = p.etiqueta;
      }
    }

    const ids = [...vigentes].sort((a, b) => a - b).join(",");
    if (ids && ids !== idsEncuadradosRef.current) {
      idsEncuadradosRef.current = ids;
      const limites = L.latLngBounds(puntos.map((p) => [p.latitud, p.longitud] as [number, number]));
      mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 15 });
    }
  }, [puntos, listo]);

  return <div ref={contenedorRef} className={`relative isolate z-0 ${className ?? ""}`} />;
}
