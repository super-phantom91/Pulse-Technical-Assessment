import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  clearSessionCookie,
  isValidSessionId,
  requireSession,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { id }. Removes the presence row and any pending
// signals to/from this user. Called via navigator.sendBeacon on tab close, so
// the body may arrive as text — parse defensively.
export async function POST(request: NextRequest) {
  let id: string | undefined;
  try {
    const text = await request.text();
    id = text ? (JSON.parse(text)?.id as string | undefined) : undefined;
  } catch {
    id = undefined;
  }

  if (!id || !isValidSessionId(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  const authErr = await requireSession(request, id);
  if (authErr) return authErr;

  await prisma.signal.deleteMany({
    where: { OR: [{ toId: id }, { fromId: id }] },
  });
  await prisma.presence.deleteMany({ where: { id } });

  const response = Response.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
