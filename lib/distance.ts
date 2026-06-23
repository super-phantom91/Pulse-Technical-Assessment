// Great-circle distance + privacy-safe resonance bands for map UX.

export type ResonanceBand = "near" | "regional" | "distant" | "far";

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function resonanceBand(km: number): ResonanceBand {
  if (km < 50) return "near";
  if (km < 500) return "regional";
  if (km < 3000) return "distant";
  return "far";
}

export function resonanceLabel(band: ResonanceBand): string {
  switch (band) {
    case "near":
      return "Very close";
    case "regional":
      return "Same region";
    case "distant":
      return "Across the horizon";
    case "far":
      return "Far away";
  }
}

/** Closer strangers pulse faster — feels like a living heartbeat. */
export function pulseDurationSec(km: number): number {
  if (km < 50) return 1.1;
  if (km < 500) return 1.8;
  if (km < 3000) return 2.6;
  return 3.4;
}

/** Gentle arc for the resonance tether between two map points. */
export function resonanceArc(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  steps = 48,
): [number, number][] {
  const coords: [number, number][] = [];
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const km = haversineKm(lat1, lng1, lat2, lng2);
  const lift = Math.min(km / 10000, 0.2);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = lat1 + (lat2 - lat1) * t;
    const lng = lng1 + (lng2 - lng1) * t;
    const bend = Math.sin(Math.PI * t);
    coords.push([
      lng + (midLng - lng) * bend * 0.14,
      lat + (midLat - lat) * bend * 0.14 + bend * lift,
    ]);
  }
  return coords;
}
