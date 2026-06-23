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
- **Long-message layout fix** — Long or unbroken text (URLs, pasted paragraphs) blew out the chat panel because flex children lacked `min-h-0` / `min-w-0` and bubbles had no word-wrap. Added `overflow-hidden` on the panel, `min-h-0` on the scroll area, `overflow-wrap: anywhere` on bubbles so the header/input stay pinned and messages scroll inside the sheet.
- **Emoji picker** — Added a 😊 toggle beside the message input with a scrollable picker (~500+ emojis). **Category navigation bar** at the top (Smileys, Gestures, Hearts, Animals, Food, Activities, Travel, Objects, Symbols, Weather) with icon tabs — tap a category to switch the grid; emerald scrollbar on the emoji grid.

**Thinking:** Kept the map full-screen as the hero; chat is a non-blocking overlay so the globe stays visible. Mobile-first bottom sheet avoids covering the entire map on small screens. Motion is purposeful (entry stagger, bubble appear, status blink) — not decorative noise. Emojis ship without a third-party picker library to keep the bundle light.

---

## Phase 3 — Make it secure

**Review approach:** Walked every `/api/*` route for auth, abuse, and data exposure. Prioritized fixes that work on Vercel serverless without adding Redis or accounts.

| Priority | Issue | Fix |
|----------|-------|-----|
| **High** | Session impersonation | Added server-issued `token` on `Presence` + HttpOnly `pulse_session` cookie set by `/api/join`. `poll`, `signal`, and `leave` now call `requireSession()` — cookie must match the claimed session id and DB token. |
| **High** | Signal / mailbox flooding | Rate limit: max 120 signals/min per `fromId`. Cap pending inbox at 80 per `toId`. Drain max 50 signals per poll. |
| **Medium** | Weak id validation | All session ids must be UUID v4. Reject `fromId === toId`. Sender must be an online presence row. |
| **Medium** | Missing sender checks | `/api/signal` verifies sender exists; offline recipients return 404 (except auto-decline on `request`). |
| **Low** | Browser hardening | Added `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` via `next.config.ts`. |
| **Low** | IP geo dependency | `/api/geo` unchanged — still a best-effort fallback; no PII stored. |

**How I fixed it:**

1. **Threat model first** — Listed what an attacker could do without logging in: spoof `fromId` on `/api/signal`, drain someone’s mailbox, force `leave` on another user, spam join upserts.
2. **Session binding** — `lib/session.ts` issues `id.token` in an HttpOnly cookie on join; every mutating/read-private route checks cookie + DB token. Client sends `credentials: "include"` on all fetches (sendBeacon is same-origin and carries cookies).
3. **Abuse caps** — `lib/rate-limit.ts` counts recent signals per sender and pending rows per inbox; poll batch size capped so one tick can’t dump an unbounded mailbox.
4. **Schema** — `Presence.token` + `@@index([fromId, createdAt])` on `Signal` for rate-limit queries.
5. **Verify** — `npx prisma db push`, `npx tsc --noEmit`; smoke-test two tabs (join → poll → signal) to confirm 401 without cookie and normal flow with cookie.

**What I did not fix (acceptable trade-offs for an anonymous MVP):**

- No per-IP rate limits on `/api/join` or `/api/geo` (serverless has no shared memory; would need edge KV or WAF).
- No cryptographic proof that WebRTC SDP payloads are well-formed (capped at 64 KB).
- Session cookie is bound to browser, not user identity — still anonymous by design.

**Deploy note:** Run `npx prisma db push` after pull — adds nullable `Presence.token` and a `Signal` index. Existing browser tabs must re-enter after deploy so join re-issues a matching cookie (legacy rows with `token = null` cannot authenticate).

---

## Phase 4 — Make it better

*Not started yet.*

Ideas: live “pulse” animation on nearby dots, optional region heatmap of online count, report/block flow for safety, or a lightweight reconnect if a tab goes to background and polling pauses.

