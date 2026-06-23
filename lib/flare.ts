// Signal Flare — wordless intent sent with a connection request (no accounts, no PII).

export type FlareIntent = "listen" | "chat" | "wander" | "spark";

const VALID = new Set<string>(["listen", "chat", "wander", "spark"]);

export interface FlareMeta {
  id: FlareIntent;
  emoji: string;
  label: string;
  tagline: string;
  promptTitle: string;
  promptSubtitle: string;
  hue: number;
}

export const FLARES: FlareMeta[] = [
  {
    id: "listen",
    emoji: "👂",
    label: "Listen",
    tagline: "Quiet company",
    promptTitle: "Someone wants to listen",
    promptSubtitle: "No pressure to perform — just share the air if you want.",
    hue: 198,
  },
  {
    id: "chat",
    emoji: "💬",
    label: "Chat",
    tagline: "Open to talk",
    promptTitle: "Someone wants to chat",
    promptSubtitle: "Up for a real conversation with a stranger on the map.",
    hue: 158,
  },
  {
    id: "wander",
    emoji: "🌊",
    label: "Wander",
    tagline: "See where it goes",
    promptTitle: "A wanderer reached out",
    promptSubtitle: "Browsing the globe — connect if you're curious too.",
    hue: 248,
  },
  {
    id: "spark",
    emoji: "✨",
    label: "Spark",
    tagline: "Curious energy",
    promptTitle: "Someone sent a spark",
    promptSubtitle: "A bright ping across the map — say hi if it lands right.",
    hue: 38,
  },
];

export function parseFlare(
  payload: string | null | undefined,
): FlareIntent | null {
  if (!payload || !VALID.has(payload)) return null;
  return payload as FlareIntent;
}

export function flareMeta(intent: FlareIntent): FlareMeta {
  return FLARES.find((f) => f.id === intent) ?? FLARES[1];
}

export function isValidFlare(payload: string): boolean {
  return VALID.has(payload);
}
