// Session-local ghost list — blocked strangers vanish from map and auto-decline.

const KEY = "pulse_ghosted";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as unknown;
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.filter((id) => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function write(ids: Set<string>): void {
  sessionStorage.setItem(KEY, JSON.stringify([...ids]));
}

export function getBlockedIds(): Set<string> {
  return read();
}

export function isBlocked(id: string): boolean {
  return read().has(id);
}

export function blockPeer(id: string): void {
  const ids = read();
  ids.add(id);
  write(ids);
}
