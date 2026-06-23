import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SignalType } from "@/lib/types";
import { isMailboxFull, isSignalRateLimited } from "@/lib/rate-limit";
import { isValidSessionId, requireSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: SignalType[] = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
];

const MAX_PAYLOAD = 64 * 1024; // SDP/ICE are small; cap to be safe.

// POST /api/signal — body { fromId, toId, type, payload? }
// Drops one message into the recipient's mailbox. Also manages the `busy`
// flag so a user can only be in one connection at a time.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { fromId, toId, type, payload } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (!isValidSessionId(fromId) || !isValidSessionId(toId)) {
    return Response.json({ error: "invalid ids" }, { status: 400 });
  }
  if (fromId === toId) {
    return Response.json({ error: "invalid ids" }, { status: 400 });
  }
  if (typeof type !== "string" || !VALID_TYPES.includes(type as SignalType)) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }
  if (
    payload !== undefined &&
    payload !== null &&
    (typeof payload !== "string" || payload.length > MAX_PAYLOAD)
  ) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const authErr = await requireSession(request, fromId);
  if (authErr) return authErr;

  const signalType = type as SignalType;
  const payloadStr = typeof payload === "string" ? payload : null;

  if (await isSignalRateLimited(fromId)) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }

  const sender = await prisma.presence.findUnique({
    where: { id: fromId },
    select: { id: true },
  });
  if (!sender) {
    return Response.json({ error: "sender offline" }, { status: 403 });
  }

  const recipient = await prisma.presence.findUnique({
    where: { id: toId },
    select: { busy: true },
  });
  if (!recipient) {
    if (signalType === "request") {
      await sendDecline(toId, fromId);
      return Response.json({ ok: true, autoDeclined: true });
    }
    return Response.json({ error: "recipient offline" }, { status: 404 });
  }

  if (await isMailboxFull(toId)) {
    return Response.json({ error: "mailbox full" }, { status: 429 });
  }

  // Enforce "one active connection at a time": if the target is already busy,
  // auto-decline the request instead of delivering it.
  if (signalType === "request" && recipient.busy) {
    await sendDecline(toId, fromId);
    return Response.json({ ok: true, autoDeclined: true });
  }

  // Busy transitions:
  // - accept: the connection is now active → mark BOTH peers busy.
  // - decline/end: free both peers.
  if (signalType === "accept") {
    await prisma.presence.updateMany({
      where: { id: { in: [fromId, toId] } },
      data: { busy: true },
    });
  } else if (signalType === "decline" || signalType === "end") {
    await prisma.presence.updateMany({
      where: { id: { in: [fromId, toId] } },
      data: { busy: false },
    });
  }

  await prisma.signal.create({
    data: { fromId, toId, type: signalType, payload: payloadStr },
  });

  return Response.json({ ok: true });
}

// Helper: deliver an auto-decline from `target` back to `initiator`.
async function sendDecline(targetId: string, initiatorId: string) {
  await prisma.signal.create({
    data: { fromId: targetId, toId: initiatorId, type: "decline", payload: null },
  });
}
