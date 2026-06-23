import { prisma } from "@/lib/prisma";

const SIGNAL_RATE_WINDOW_MS = 60_000;
const SIGNAL_RATE_MAX = 120;
const MAILBOX_MAX_PENDING = 80;

/** True when the sender exceeded the per-minute signal cap. */
export async function isSignalRateLimited(fromId: string): Promise<boolean> {
  const count = await prisma.signal.count({
    where: {
      fromId,
      createdAt: { gte: new Date(Date.now() - SIGNAL_RATE_WINDOW_MS) },
    },
  });
  return count >= SIGNAL_RATE_MAX;
}

/** True when the recipient's inbox is at capacity. */
export async function isMailboxFull(toId: string): Promise<boolean> {
  const count = await prisma.signal.count({ where: { toId } });
  return count >= MAILBOX_MAX_PENDING;
}
