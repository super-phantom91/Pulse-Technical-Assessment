import { prisma } from "@/lib/prisma";

export const SIGNAL_RATE_WINDOW_MS = 60_000;
export const SIGNAL_RATE_MAX = 120;
export const MAILBOX_MAX_PENDING = 80;

export async function isSignalRateLimited(fromId: string): Promise<boolean> {
  const count = await prisma.signal.count({
    where: {
      fromId,
      createdAt: { gte: new Date(Date.now() - SIGNAL_RATE_WINDOW_MS) },
    },
  });
  return count >= SIGNAL_RATE_MAX;
}

export async function isMailboxFull(toId: string): Promise<boolean> {
  const count = await prisma.signal.count({ where: { toId } });
  return count >= MAILBOX_MAX_PENDING;
}
