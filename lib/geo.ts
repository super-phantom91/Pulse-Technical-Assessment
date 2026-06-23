// Privacy offset: move a real coordinate 1–3 km in a random direction so the
// dot is placed *near* the user, never at their exact location. A fresh random
// offset is generated each session (this runs once per join), so the same user
// lands somewhere different every time.

const KM_PER_DEG_LAT = 111.32;

/** Shift coordinates 1–3 km in a random direction for map privacy. */
export function applyPrivacyOffset(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  const distanceKm = 1 + Math.random() * 2; // 1–3 km
  const bearing = Math.random() * 2 * Math.PI; // random direction

  const dLat = (distanceKm * Math.cos(bearing)) / KM_PER_DEG_LAT;
  const latRad = (lat * Math.PI) / 180;
  const dLng =
    (distanceKm * Math.sin(bearing)) /
    (KM_PER_DEG_LAT * Math.cos(latRad) || KM_PER_DEG_LAT);

  return {
    lat: clamp(lat + dLat, -90, 90),
    lng: wrapLng(lng + dLng),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Keep longitude in [-180, 180]. */
function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/** True for finite lat/lng within valid geographic bounds. */
export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export type LatLng = { latitude: number; longitude: number };

/** Wrap getCurrentPosition in a Promise. */
function readPosition(options: PositionOptions): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      reject,
      options,
    );
  });
}

/** Fallback approximate location from GET /api/geo. */
async function fetchApproximateLocation(): Promise<LatLng> {
  const res = await fetch("/api/geo", { cache: "no-store" });
  if (!res.ok) {
    throw Object.assign(new Error("ip geo failed"), { code: 2 });
  }
  const data = (await res.json()) as { lat: unknown; lng: unknown };
  if (!isValidLatLng(data.lat, data.lng)) {
    throw Object.assign(new Error("invalid ip geo"), { code: 2 });
  }
  return { latitude: data.lat as number, longitude: data.lng as number };
}

/** Browser geolocation when available, then IP lookup as fallback. */
export async function getUserLocation(): Promise<LatLng> {
  if (typeof navigator !== "undefined" && "geolocation" in navigator) {
    const attempts: PositionOptions[] = [
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
    ];

    for (const options of attempts) {
      try {
        const coords = await readPosition(options);
        if (isValidLatLng(coords.latitude, coords.longitude)) return coords;
      } catch {
        // Try the next strategy, then IP lookup.
      }
    }
  }

  return fetchApproximateLocation();
}
