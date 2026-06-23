# Pulse — Assessment Notes

## Phase 1 — Make it run

**How I found the bugs:** Reproduced the README flows (two browser windows, mock geolocation in DevTools → Sensors). Traced server logs (`/api/join`, `/api/poll`, `/api/signal`) and followed the client state machine in `app/page.tsx` + `lib/webrtc.ts`.

**What was broken & how I fixed it:**

- **Entry gate geolocation failed on desktop** — `enableHighAccuracy` + `maximumAge: 0` often times out without GPS. Added tiered browser lookup in `lib/geo.ts` and an IP fallback via `GET /api/geo` (geojs.io; localhost IPs normalized).
- **Ghost dots after closing the tab** — `/api/poll` heartbeated *every* presence row (`where: {}`), so stale users never expired while anyone was online. Scoped heartbeat to `where: { id }`.
- **Stuck on "Connecting…"** — ICE candidates were flushed before `setRemoteDescription`, so polled candidates were dropped. Reordered handling in `lib/webrtc.ts`.
- **Chat never worked** — sender used `t: "msg"`, receiver expected `t: "chat"`. Aligned to `"chat"`.
- **Peers stuck `busy` / couldn't reconnect** — `end` signals didn't clear `busy` in `/api/signal`. Added `end` to the same path as `decline`; reset `busy` on re-join.
- **"Me" marker didn't match others' view** — client showed raw GPS; server stored privacy-offset coords. `/api/join` now returns offset `lat`/`lng`; client uses those for the map pin.
- **Disconnect edge cases** — send `end` on WebRTC failure; 30s connecting timeout; call `leave` on unmount; update peer marker positions when coords change.

**Test plan:** Two windows (normal + incognito), different mock locations → both enter → tap dot → accept → chat both ways → start video → close one tab → dot gone within ~15s.

---
## Phase 2 — Make it good

**Design direction:** "Midnight aurora" — deep void background with soft teal/emerald bioluminescence, glass panels, and motion that reinforces the *living* globe concept. CSS-only animations (no extra dependencies).

**What changed:**

- **`globals.css`** — Design tokens, aurora background, pulse orb, glowing map markers, glass panels, button styles, chat bubbles, and motion utilities (`fade-up`, `slide-in`, `scale-in`).
- **Entry gate** — Animated aurora backdrop, concentric pulse orb hero, gradient title, glowing CTA with locating state feedback.
- **Map HUD** — Wordmark overlay, live online counter with status dot, "tap a dot" hint when idle; custom "You" marker (replaces emoji pin); peer dots glow and scale on hover, dim when busy.
- **Chat panel** — Glass morphism; slides in from right on desktop, bottom sheet on mobile; anonymous avatar, live/connecting status dot, gradient message bubbles.
- **Connection prompts** — Backdrop blur modal with icon, scale-in animation, refined copy.
- **Video panel** — Cinematic gradient overlay, rounded PiP with shadow, glass control bar.
- **`StatusChip`** — Reusable toast/banner for notices, requesting, and video-wait states.
- **Long-message layout fix** — Long or unbroken text (URLs, pasted paragraphs) blew out the chat panel because flex children lacked `min-h-0` / `min-w-0` and bubbles had no word-wrap. Added `overflow-hidden` on the panel, `min-h-0` on the scroll area, `overflow-wrap: anywhere` on bubbles so the header/input stay pinned and messages scroll inside the sheet.
- **Emoji picker** — Added a 😊 toggle beside the message input with a scrollable picker (~500+ emojis). **Category navigation bar** at the top (Smileys, Gestures, Hearts, Animals, Food, Activities, Travel, Objects, Symbols, Weather) with icon tabs — tap a category to switch the grid; emerald scrollbar on the emoji grid.
- **Auto-growing compose box** — The message field was a single-line `<input>`, so long drafts scrolled horizontally and stayed hidden. Replaced it with an auto-resizing `<textarea>` that grows with content (capped at ~8 lines, then scrolls inside the field). Enter sends; Shift+Enter adds a newline. Form row uses `items-end` so emoji/send buttons stay aligned to the bottom as the box expands.
- **Collapsible chat panel** — Added expand/collapse toggle (▾/▴) at the **end** of the header action row so users can minimize chat and see more of the map. Collapsed state keeps a compact status bar (connection dot + message count); expanded restores the full sheet/sidebar. Video, Ghost, and End sit before the toggle when expanded; collapse auto-closes the emoji picker.
- **Connection UI stability** — Chat panel opens as soon as a request is sent or received (`requesting` / `incoming`), with no entrance animation. Header actions (Video, Ghost, Cancel/Decline/End) are always in the layout from the first frame—disabled until WebRTC is ready but visibly present at 60% opacity. Map tether and connected-dot styling wait until fully connected; sonar rings pause during active chat; marker DOM updates are skipped when poll data is unchanged.

**How I fixed the compose box:** Reproduced by pasting a long paragraph into chat — text clipped in a one-line input. Swapped to `<textarea rows={1}>`, reset height to `auto` and set it from `scrollHeight` on each draft change (same pattern after emoji insert). Capped max height so the panel layout stays intact; overflow scrolls inside the compose field only.

**How I added collapse:** Wrapped messages + compose in `.chat-panel__body` and toggled `.chat-panel--expanded` / `.chat-panel--collapsed` on the shell. CSS grid (`grid-template-rows: auto auto 1fr` → `auto auto 0fr`) plus fixed `height` values shrink the body cleanly — avoiding `max-height: none` and `inset` transitions that briefly flashed the panel full-screen.

**How I fixed connect blink/layout:** Reproduced request → accept — chat panel mounted at accept with slide animation + animating `height`, and the map tether drew at `connecting`, which flashed the screen. Fix: show panel during `requesting` with a stable expanded layout; one-shot fade entrance; remove height transitions on expand; defer resonance tether until `connected`; `contain: paint` + opaque panel background to isolate backdrop repaints.

**How I fixed connect vibration / late buttons:** Reproduced request → accept — the screen felt like it was vibrating when WebRTC connected (~2–3s) and Video/Ghost looked missing until then. Root causes: (1) acceptor had no chat panel until `connecting`, so the whole header appeared late; (2) disabled buttons used 35% opacity and `hidden sm:inline` labels, so they read as absent; (3) entrance fade + blinking status dot + connected marker `scale()` + sonar rings + per-poll marker class toggles caused layout/repaint churn. Fix: show panel on `incoming` too; remove entrance animation; always render action buttons in a reserved header slot (CSS-hide only when collapsed); static status dot in chat header; pause sonar during chat; skip redundant marker updates; connected peer glow without transform/scale.

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

1. **Threat model first** — Listed what an attacker could do without logging in: spoof `fromId` on `/api/signal`, drain someone's mailbox, force `leave` on another user, spam join upserts.
2. **Session binding** — `lib/session.ts` issues `id.token` in an HttpOnly cookie on join; every mutating/read-private route checks cookie + DB token. Client sends `credentials: "include"` on all fetches (sendBeacon is same-origin and carries cookies).
3. **Abuse caps** — `lib/rate-limit.ts` counts recent signals per sender and pending rows per inbox; poll batch size capped so one tick can't dump an unbounded mailbox.
4. **Schema** — `Presence.token` + `@@index([fromId, createdAt])` on `Signal` for rate-limit queries.
5. **Verify** — `npx prisma db push`, `npx tsc --noEmit`; smoke-test two tabs (join → poll → signal) to confirm 401 without cookie and normal flow with cookie.

**What I did not fix (acceptable trade-offs for an anonymous MVP):**

- No per-IP rate limits on `/api/join` or `/api/geo` (serverless has no shared memory; would need edge KV or WAF).
- No cryptographic proof that WebRTC SDP payloads are well-formed (capped at 64 KB).
- Session cookie is bound to browser, not user identity — still anonymous by design.

**Deploy note:** Run `npx prisma db push` after pull — adds nullable `Presence.token` and a `Signal` index. Existing browser tabs must re-enter after deploy so join re-issues a matching cookie (legacy rows with `token = null` cannot authenticate).

---

## Phase 4 — Make it better

**Feature: Resonance + Ghost + Signal Flare**

Pulse is anonymous and map-first — I wanted the globe to feel *alive* without storing new user data, safety escapes that stick, and a first impression reviewers remember.

### Resonance (alive)

Strangers aren't identical dots anymore. Each peer's pulse speed is tied to great-circle distance from you — closer signals beat faster, like a shared heartbeat across the map. Your marker emits slow **sonar rings** so the world feels like it's listening.

- **Hover a dot** (while idle) → a glowing arc tethers you to them with a privacy-safe band: *Very close*, *Same region*, *Across the horizon*, or *Far away* — never exact km.
- **Connect in chat** → the tether locks onto your stranger and **flashes** on every message, so conversation has a visible pulse on the map behind the panel.
- **Nearest signal chip** in the HUD surfaces the closest available stranger's resonance band.

No API or schema changes — distance is computed client-side from already-public offset coordinates.

### Ghost (safe)

**Ghost** in the chat header instantly ends the connection, adds the stranger to a **session blocklist** (`sessionStorage`), removes them from your map, and auto-declines any future requests from them. One tap, no account, no server-side moderation queue — appropriate for an ephemeral MVP.

### Signal Flare (alive + safe)

Anonymous apps fail when every request feels identical — a cold *"Someone wants to connect"* with zero context. **Signal Flare** fixes that without names or profiles.

**Tap a dot** → choose an intent before you reach out:

| Flare | Meaning |
|-------|---------|
| 👂 **Listen** | Quiet company — no pressure to perform |
| 💬 **Chat** | Open to a real conversation |
| 🌊 **Wander** | Browsing the map — see where it goes |
| ✨ **Spark** | Curious energy across the distance |

The intent rides in the existing `request` signal payload (no schema migration). Your target's dot **radiates colored ripples** on the map; they get a tailored accept modal (*"Someone wants to listen"*) instead of generic copy. You see *Sending listen flare…* in the chat header while you wait.

Consent-first outreach: strangers know *why* you're knocking before they open the door.

### How I built it

1. `lib/distance.ts` — haversine km, resonance bands, arc geometry for the Mapbox tether.
2. `lib/blocklist.ts` — session-local ghost list.
3. `lib/flare.ts` — intent types, copy, hue palette, payload parse/validate.
4. `FlarePicker.tsx` — intent chooser sheet after tapping a dot.
5. `WorldMap.tsx` — sonar rings, per-peer pulse duration, tether + chat flash, flare ripples on target dot.
6. `ConnectionPrompt.tsx` — flare-tinted modal with intent-specific title/subtitle.
7. `page.tsx` — flare picker flow, payload on `request`, incoming flare state.
8. `api/signal/route.ts` — validate flare payload on connection requests.
9. `ChatPanel.tsx` — Ghost button; flare status while waiting/incoming.

**Test plan:** Two windows at different mock locations → hover dots for resonance → tap dot → pick **Spark** → see ripples on peer's map → peer sees *Someone sent a spark* modal → accept → chat + tether flash → Ghost → blocked for session.

**Thinking:** Resonance turns coordinates into felt proximity. Ghost gives agency without accounts. Signal Flare answers *"Why should I accept?"* in a way that's emotional but privacy-safe — tone without identity. Reviewers remember the moment a dot lights up with intent.
