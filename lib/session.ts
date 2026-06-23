import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "pulse_session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSessionId(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

export function generateSessionToken(): string {
  return crypto.randomUUID();
}

export function sessionCookieValue(id: string, token: string): string {
  return `${id}.${token}`;
}

export function parseSessionCookie(
  value: string | undefined,
): { id: string; token: string } | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const token = value.slice(dot + 1);
  if (!isValidSessionId(id) || token.length < 8) return null;
  return { id, token };
}

export function getSessionFromRequest(
  request: NextRequest,
): { id: string; token: string } | null {
  return parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
}

export function setSessionCookie(
  response: Response,
  id: string,
  token: string,
): void {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE}=${sessionCookieValue(id, token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=3600",
  ];
  if (secure) parts.push("Secure");
  response.headers.append("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(response: Response): void {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  response.headers.append("Set-Cookie", parts.join("; "));
}

/** Returns an error Response when the cookie does not match `id`, else null. */
export async function requireSession(
  request: NextRequest,
  id: string,
): Promise<Response | null> {
  if (!isValidSessionId(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  const session = getSessionFromRequest(request);
  if (!session || session.id !== id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const row = await prisma.presence.findUnique({
    where: { id },
    select: { token: true },
  });
  if (!row?.token || row.token !== session.token) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}
