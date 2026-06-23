# Pulse — Assessment Notes

## Phase 1 — Make it run

**How I found the bugs:** Reproduced the README flows (two browser windows, mock geolocation in DevTools → Sensors). Traced server logs (`/api/join`, `/api/poll`, `/api/signal`) and followed the client state machine in `app/page.tsx` + `lib/webrtc.ts`.

**What was broken & how I fixed it:**

- **Entry gate geolocation failed on desktop** — `enableHighAccuracy` + `maximumAge: 0` often times out without GPS. Added tiered browser lookup in `lib/geo.ts` and an IP fallback via `GET /api/geo` (geojs.io; localhost IPs normalized).
- **Ghost dots after closing the tab** — `/api/poll` heartbeated *every* presence row (`where: {}`), so stale users never expired while anyone was online. Scoped heartbeat to `where: { id }`.
- **Stuck on “Connecting…”** — ICE candidates were flushed before `setRemoteDescription`, so polled candidates were dropped. Reordered handling in `lib/webrtc.ts`.
- **Chat never worked** — sender used `t: "msg"`, receiver expected `t: "chat"`. Aligned to `"chat"`.
- **Peers stuck `busy` / couldn’t reconnect** — `end` signals didn’t clear `busy` in `/api/signal`. Added `end` to the same path as `decline`; reset `busy` on re-join.
- **“Me” marker didn’t match others’ view** — client showed raw GPS; server stored privacy-offset coords. `/api/join` now returns offset `lat`/`lng`; client uses those for the map pin.
- **Disconnect edge cases** — send `end` on WebRTC failure; 30s connecting timeout; call `leave` on unmount; update peer marker positions when coords change.

**Test plan:** Two windows (normal + incognito), different mock locations → both enter → tap dot → accept → chat both ways → start video → close one tab → dot gone within ~15s.

---

## Phase 2 — Make it good

**Design direction:** “Midnight aurora” — deep void background with soft teal/emerald bioluminescence, glass panels, and motion that reinforces the *living* globe concept. CSS-only animations (no extra dependencies).

**What changed:**

- **`globals.css`** — Design tokens, aurora background, pulse orb, glowing map markers, glass panels, button styles, chat bubbles, and motion utilities (`fade-up`, `slide-in`, `scale-in`).
- **Entry gate** — Animated aurora backdrop, concentric pulse orb hero, gradient title, glowing CTA with locating state feedback.
- **Map HUD** — Wordmark overlay, live online counter with status dot, “tap a dot” hint when idle; custom “You” marker (replaces emoji pin); peer dots glow and scale on hover, dim when busy.
- **Chat panel** — Glass morphism; slides in from right on desktop, bottom sheet on mobile; anonymous avatar, live/connecting status dot, gradient message bubbles.
- **Connection prompts** — Backdrop blur modal with icon, scale-in animation, refined copy.
- **Video panel** — Cinematic gradient overlay, rounded PiP with shadow, glass control bar.
- **`StatusChip`** — Reusable toast/banner for notices, requesting, and video-wait states.

**Thinking:** Kept the map full-screen as the hero; chat is a non-blocking overlay so the globe stays visible. Mobile-first bottom sheet avoids covering the entire map on small screens. Motion is purposeful (entry stagger, bubble appear, status blink) — not decorative noise.

---

## Phase 3 — Make it secure

*Review done; fixes not yet implemented.*

| Priority | Issue | Notes |
|----------|-------|-------|
| **High** | No session auth on APIs | Any client can call `/api/signal` or `/api/leave` with arbitrary `fromId` / `id` — impersonation and griefing. |
| **High** | Signal spam / mailbox flooding | No per-session rate limit on `/api/signal`; large payloads capped at 64 KB but volume is unchecked. |
| **Medium** | Join coordinate abuse | Valid lat/lng only; no rate limit on `/api/join` upserts. |
| **Low** | IP geo dependency | `/api/geo` calls a third-party service; acceptable for fallback but should be monitored / cached. |

**Fixed in Phase 1 (related):** raw coordinates never stored; privacy offset applied server-side.

---

## Phase 4 — Make it better

*Not started yet.*

Ideas: live “pulse” animation on nearby dots, optional region heatmap of online count, report/block flow for safety, or a lightweight reconnect if a tab goes to background and polling pauses.
