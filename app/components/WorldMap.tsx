"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import {
  haversineKm,
  pulseDurationSec,
  resonanceArc,
  resonanceBand,
  resonanceLabel,
} from "@/lib/distance";
import type { PeerDot } from "@/lib/types";

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicHVsc2UtbWFwIiwiYSI6ImNrMDBkZW1vMDAwMDAwMDAifQ.AAAAAAAAAAAAAAAAAAAAAA";

const TETHER_SOURCE = "resonance-tether";
const TETHER_LAYER = "resonance-tether-line";
const TETHER_GLOW = "resonance-tether-glow";

function dotColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 72%, 58%)`;
}

function ensureTetherLayers(map: MapboxMap) {
  if (!map.getSource(TETHER_SOURCE)) {
    map.addSource(TETHER_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: TETHER_GLOW,
      type: "line",
      source: TETHER_SOURCE,
      paint: {
        "line-color": "#34d399",
        "line-width": 8,
        "line-opacity": 0.12,
        "line-blur": 4,
      },
    });
    map.addLayer({
      id: TETHER_LAYER,
      type: "line",
      source: TETHER_SOURCE,
      paint: {
        "line-color": "#2dd4bf",
        "line-width": 2.5,
        "line-opacity": 0.65,
        "line-dasharray": [2, 2],
      },
    });
  }
}

export default function WorldMap({
  peers,
  me,
  onPeerClick,
  canConnect,
  showHint,
  connectedPeerId,
  chatPulse = 0,
  quietSonar = false,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
  showHint?: boolean;
  connectedPeerId?: string | null;
  chatPulse?: number;
  quietSonar?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const meCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const peerMarkerStateRef = useRef<
    Map<
      string,
      {
        lat: number;
        lng: number;
        busy: boolean;
        band: string;
        pulseSec: number;
        connected: boolean;
      }
    >
  >(new Map());
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [hoveredPeerId, setHoveredPeerId] = useState<string | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);

  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  });

  const closestPeer = useMemo(() => {
    if (!me || peers.length === 0) return null;
    let best: PeerDot | null = null;
    let bestKm = Infinity;
    for (const p of peers) {
      if (p.busy) continue;
      const km = haversineKm(me.lat, me.lng, p.lat, p.lng);
      if (km < bestKm) {
        bestKm = km;
        best = p;
      }
    }
    if (!best) return null;
    return { peer: best, km: bestKm, band: resonanceBand(bestKm) };
  }, [me, peers]);

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
        if (!cancelled) {
          ensureTetherLayers(map);
          setReady(true);
        }
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
          <span class="pulse-sonar pulse-sonar--1"></span>
          <span class="pulse-sonar pulse-sonar--2"></span>
          <span class="pulse-sonar pulse-sonar--3"></span>
          <span class="pulse-me-ring"></span>
          <span class="pulse-me-core"></span>
        `;
        meMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
        meCoordsRef.current = { lat: me.lat, lng: me.lng };
      } else {
        const prev = meCoordsRef.current;
        if (!prev || prev.lat !== me.lat || prev.lng !== me.lng) {
          meMarkerRef.current.setLngLat([me.lng, me.lat]);
          meCoordsRef.current = { lat: me.lat, lng: me.lng };
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  useEffect(() => {
    const el = meMarkerRef.current?.getElement();
    if (!el) return;
    el.classList.toggle("pulse-me--quiet", quietSonar);
  }, [quietSonar, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const peerState = peerMarkerStateRef.current;
      const seen = new Set<string>();

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        const color = dotColor(peer.id);
        const km = me ? haversineKm(me.lat, me.lng, peer.lat, peer.lng) : 5000;
        const band = resonanceBand(km);
        const pulseSec = pulseDurationSec(km);
        const isConnected = peer.id === connectedPeerId;
        const prev = peerState.get(peer.id);

        if (!marker) {
          const el = document.createElement("button");
          el.className = "pulse-dot";
          el.style.background = color;
          el.style.color = color;
          el.dataset.peerId = peer.id;
          el.title = peer.busy ? "Busy" : "Tap to connect";
          el.disabled = peer.busy;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (canConnectRef.current) onPeerClickRef.current(peer.id);
          });
          el.addEventListener("mouseenter", () => {
            document
              .querySelectorAll(".pulse-dot--hovered")
              .forEach((n) => n.classList.remove("pulse-dot--hovered"));
            el.classList.add("pulse-dot--hovered");
            setHoveredPeerId(peer.id);
            setHoverLabel(resonanceLabel(band));
          });
          el.addEventListener("mouseleave", () => {
            el.classList.remove("pulse-dot--hovered");
            setHoveredPeerId((id) => (id === peer.id ? null : id));
            setHoverLabel(null);
          });
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        } else if (
          !prev ||
          prev.lat !== peer.lat ||
          prev.lng !== peer.lng
        ) {
          marker.setLngLat([peer.lng, peer.lat]);
        }

        const unchanged =
          prev &&
          prev.lat === peer.lat &&
          prev.lng === peer.lng &&
          prev.busy === peer.busy &&
          prev.band === band &&
          prev.pulseSec === pulseSec &&
          prev.connected === isConnected;

        if (!unchanged) {
          const el = marker.getElement() as HTMLButtonElement;
          el.classList.toggle("pulse-dot--busy", peer.busy);
          el.classList.toggle("pulse-dot--connected", isConnected);
          el.dataset.resonance = band;
          el.style.setProperty("--pulse-duration", `${pulseSec}s`);
          el.disabled = peer.busy;
          el.title = peer.busy
            ? "Busy"
            : `${resonanceLabel(band)} — tap to connect`;
        }

        peerState.set(peer.id, {
          lat: peer.lat,
          lng: peer.lng,
          busy: peer.busy,
          band,
          pulseSec,
          connected: isConnected,
        });
      }

      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
          peerState.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, ready, me, connectedPeerId]);

  // Resonance tether — arc to connected peer or hovered peer while idle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;

    const targetId = connectedPeerId ?? hoveredPeerId;
    const target = targetId ? peers.find((p) => p.id === targetId) : null;
    const source = map.getSource(TETHER_SOURCE) as
      | { setData: (d: GeoJSON.FeatureCollection) => void }
      | undefined;

    if (!source) return;

    if (!target) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const coords = resonanceArc(me.lat, me.lng, target.lat, target.lng);
    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        },
      ],
    });
  }, [me, peers, ready, connectedPeerId, hoveredPeerId]);

  // Flash tether when a chat message lands.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || chatPulse === 0) return;
    if (!map.getLayer(TETHER_LAYER)) return;

    map.setPaintProperty(TETHER_LAYER, "line-opacity", 1);
    map.setPaintProperty(TETHER_GLOW, "line-opacity", 0.45);
    const t1 = window.setTimeout(() => {
      map.setPaintProperty(TETHER_LAYER, "line-opacity", 0.65);
      map.setPaintProperty(TETHER_GLOW, "line-opacity", 0.12);
    }, 280);
    return () => window.clearTimeout(t1);
  }, [chatPulse, ready]);

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

      <div className="pointer-events-none absolute top-0 left-0 z-10 p-5">
        <p className="bg-gradient-to-r from-white to-emerald-200/70 bg-clip-text text-lg font-bold tracking-tight text-transparent">
          Pulse
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 z-10 flex flex-col gap-2">
        <div className="glass-panel flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm text-zinc-300 shadow-lg">
          <span className="status-dot status-dot--live" aria-hidden />
          <span>
            <span className="font-semibold text-white">{peers.length}</span>{" "}
            {peers.length === 1 ? "stranger" : "strangers"} online
          </span>
        </div>

        {closestPeer && !connectedPeerId && canConnect && (
          <div className="resonance-chip animate-fade-up glass-panel rounded-2xl px-4 py-2.5 text-xs text-zinc-400 shadow-lg">
            <span className="resonance-chip-dot" aria-hidden />
            Nearest signal:{" "}
            <span className="font-semibold text-emerald-300">
              {resonanceLabel(closestPeer.band)}
            </span>
          </div>
        )}

        {hoverLabel && !connectedPeerId && (
          <div
            ref={tooltipRef}
            className="resonance-chip glass-panel rounded-full px-4 py-2 text-xs text-emerald-200 shadow-lg"
          >
            Resonance · {hoverLabel}
          </div>
        )}
      </div>

      {showHint && peers.length > 0 && !connectedPeerId && (
        <div className="animate-fade-up pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2">
          <p className="glass-panel rounded-full px-4 py-2 text-xs text-zinc-400">
            Strangers pulse faster when they&apos;re closer — tap a dot to connect
          </p>
        </div>
      )}
    </div>
  );
}
