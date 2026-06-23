import type { NextRequest } from "next/server";
import { isValidLatLng } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseHeaderCoord(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeIp(ip: string | null): string | null {
  if (!ip) return null;
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function isLocalIp(ip: string | null): boolean {
  const normalized = normalizeIp(ip);
  if (!normalized) return true;
  if (normalized === "127.0.0.1" || normalized === "::1") return true;
  if (normalized.startsWith("10.")) return true;
  if (normalized.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalized)) return true;
  return false;
}

async function lookupByIp(
  ip: string | null,
): Promise<{ lat: number; lng: number } | null> {
  const normalized = normalizeIp(ip);
  const url = isLocalIp(ip)
    ? "https://get.geojs.io/v1/ip/geo.json"
    : `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(normalized!)}.json`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    latitude?: string | number;
    longitude?: string | number;
  };

  const lat = Number(data.latitude);
  const lng = Number(data.longitude);
  if (!isValidLatLng(lat, lng)) return null;

  return { lat, lng };
}

// GET /api/geo — approximate lat/lng from Vercel headers or client IP.
export async function GET(request: NextRequest) {
  const lat = parseHeaderCoord(request.headers.get("x-vercel-ip-latitude"));
  const lng = parseHeaderCoord(request.headers.get("x-vercel-ip-longitude"));
  if (isValidLatLng(lat, lng)) {
    return Response.json({ lat, lng });
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  const coords = await lookupByIp(ip);
  if (!coords) {
    return Response.json({ error: "location unavailable" }, { status: 503 });
  }

  return Response.json(coords);
}
