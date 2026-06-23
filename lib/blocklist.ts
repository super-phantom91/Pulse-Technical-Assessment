// Session-local ghost list — blocked strangers vanish from map and auto-decline.

const KEY = "pulse_ghosted";

/** Load blocked peer ids from sessionStorage. */
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

/** Persist blocked peer ids to sessionStorage. */
function write(ids: Set<string>): void {
  sessionStorage.setItem(KEY, JSON.stringify([...ids]));
}

/** Return all ghosted peer ids for this browser session. */
export function getBlockedIds(): Set<string> {
  return read();
}

/** True when the peer was ghosted earlier this session. */
export function isBlocked(id: string): boolean {
  return read().has(id);
}

/** Add a peer to the session blocklist. */
export function blockPeer(id: string): void {
  const ids = read();
  ids.add(id);
  write(ids);
}
