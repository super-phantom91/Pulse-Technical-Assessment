"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "pk.eyJ1IjoicHVsc2UtbWFwIiwiYSI6ImNrMDBkZW1vMDAwMDAwMDAifQ.AAAAAAAAAAAAAAAAAAAAAA";

function dotColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 72%, 58%)`;
}

export default function WorldMap({
  peers,
  me,
  onPeerClick,
  canConnect,
  showHint,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
  showHint?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  });

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: me ? [me.lng, me.lat] : [0, 20],
        zoom: me ? 4 : 1.4,
        attributionControl: true,
      });
      map.on("load", () => {
        if (!cancelled) setReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "pulse-me";
        el.title = "You are here";
        el.innerHTML = `
          <span class="pulse-me-label">You</span>
          <span class="pulse-me-ring"></span>
          <span class="pulse-me-core"></span>
        `;
        meMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        const color = dotColor(peer.id);

        if (!marker) {
          const el = document.createElement("button");
          el.className = "pulse-dot";
          el.style.background = color;
          el.style.color = color;
          el.title = peer.busy ? "Busy" : "Tap to connect";
          el.disabled = peer.busy;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (canConnectRef.current) onPeerClickRef.current(peer.id);
          });
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        } else {
          marker.setLngLat([peer.lng, peer.lat]);
        }

        const el = marker.getElement() as HTMLButtonElement;
        el.classList.toggle("pulse-dot--busy", peer.busy);
        el.disabled = peer.busy;
        el.title = peer.busy ? "Busy" : "Tap to connect";
      }

      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-[#030308]" />

      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="glass-panel max-w-md rounded-2xl p-6 text-sm text-zinc-200">
            Set{" "}
            <code className="text-emerald-400">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
            <code>.env</code> to load the map.
          </p>
        </div>
      )}

      {/* HUD — wordmark */}
      <div className="pointer-events-none absolute top-0 left-0 z-10 p-5">
        <p className="bg-gradient-to-r from-white to-emerald-200/70 bg-clip-text text-lg font-bold tracking-tight text-transparent">
          Pulse
        </p>
      </div>

      {/* HUD — online count */}
      <div className="glass-panel pointer-events-none absolute bottom-5 left-5 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm text-zinc-300 shadow-lg">
        <span className="status-dot status-dot--live" aria-hidden />
        <span>
          <span className="font-semibold text-white">{peers.length}</span>{" "}
          {peers.length === 1 ? "stranger" : "strangers"} online
        </span>
      </div>

      {/* Tap hint */}
      {showHint && peers.length > 0 && (
        <div className="animate-fade-up pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2">
          <p className="glass-panel rounded-full px-4 py-2 text-xs text-zinc-400">
            Tap a glowing dot to connect
          </p>
        </div>
      )}
    </div>
  );
}
