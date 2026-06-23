"use client";

import { useEffect, useRef, useState } from "react";
import { CHAT_EMOJI_GROUPS } from "@/lib/chat-emojis";
import { flareMeta, type FlareIntent } from "@/lib/flare";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

export type ChatPhase = "incoming" | "waiting" | "connecting" | "connected";

/** Collapsible chat panel with compose field and emoji picker. */
export default function ChatPanel({
  phase,
  flareIntent,
  messages,
  videoBusy,
  onSend,
  onStartVideo,
  onEnd,
  onGhost,
}: {
  phase: ChatPhase;
  flareIntent?: FlareIntent | null;
  messages: ChatMessage[];
  videoBusy: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
  onGhost: () => void;
}) {
  const connected = phase === "connected";
  const statusLabel =
    phase === "waiting" && flareIntent
      ? `Sending ${flareMeta(flareIntent).label.toLowerCase()} flare…`
      : phase === "incoming" && flareIntent
        ? `${flareMeta(flareIntent).emoji} ${flareMeta(flareIntent).promptTitle}`
        : phase === "connected"
        ? "Connected"
        : phase === "connecting"
          ? "Connecting…"
          : phase === "incoming"
            ? "Incoming request…"
            : "Waiting for answer…";
  const endLabel =
    phase === "waiting"
      ? "Cancel"
      : phase === "incoming"
        ? "Decline"
        : "End";
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(CHAT_EMOJI_GROUPS[0].label);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const emojiPanelScrollRef = useRef<HTMLDivElement>(null);
  const categoryDragRef = useRef({
    active: false,
    moved: false,
    suppressClick: false,
    startX: 0,
    scrollLeft: 0,
    pointerId: -1,
  });

  const activeEmojiGroup =
    CHAT_EMOJI_GROUPS.find((g) => g.label === emojiCategory) ??
    CHAT_EMOJI_GROUPS[0];

  const COMPOSE_MAX_HEIGHT = 160;

  /** Grow the compose textarea to fit draft content. */
  function resizeCompose() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, COMPOSE_MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > COMPOSE_MAX_HEIGHT ? "auto" : "hidden";
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (emojiOpen) setEmojiCategory(CHAT_EMOJI_GROUPS[0].label);
  }, [emojiOpen]);

  useEffect(() => {
    if (!emojiOpen) return;
    const navEl = categoryNavRef.current;
    if (!navEl) return;
    const nav: HTMLDivElement = navEl;

    const drag = categoryDragRef.current;

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      if (!nav.contains(e.target as Node)) return;

      drag.active = true;
      drag.moved = false;
      drag.suppressClick = false;
      drag.startX = e.clientX;
      drag.scrollLeft = nav.scrollLeft;
      drag.pointerId = e.pointerId;
    }

    function onPointerMove(e: PointerEvent) {
      if (!drag.active || drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.startX;
      if (!drag.moved && Math.abs(dx) > 5) {
        drag.moved = true;
        nav.classList.add("emoji-category-nav--dragging");
      }
      if (drag.moved) {
        e.preventDefault();
        nav.scrollLeft = drag.scrollLeft - dx;
      }
    }

    function endDrag(e: PointerEvent) {
      if (!drag.active || drag.pointerId !== e.pointerId) return;

      nav.classList.remove("emoji-category-nav--dragging");
      if (drag.moved) {
        drag.suppressClick = true;
        window.setTimeout(() => {
          drag.suppressClick = false;
        }, 100);
      }

      drag.active = false;
      drag.moved = false;
      drag.pointerId = -1;
    }

    function onWheel(e: WheelEvent) {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      nav.scrollLeft += delta;
    }

    nav.addEventListener("pointerdown", onPointerDown);
    nav.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      nav.removeEventListener("pointerdown", onPointerDown);
      nav.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      nav.classList.remove("emoji-category-nav--dragging");
      drag.active = false;
      drag.moved = false;
      drag.pointerId = -1;
    };
  }, [emojiOpen]);

  useEffect(() => {
    if (!emojiOpen) return;
    const activeTab = categoryNavRef.current?.querySelector(
      `[data-category="${emojiCategory}"]`,
    );
    activeTab?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
    emojiPanelScrollRef.current?.scrollTo(0, 0);
  }, [emojiCategory, emojiOpen]);

  useEffect(() => {
    if (!emojiOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest("[data-emoji-toggle]")
      ) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [emojiOpen]);

  useEffect(() => {
    resizeCompose();
  }, [draft]);

  /** Insert emoji at end of draft and refocus compose. */
  function insertEmoji(emoji: string) {
    setDraft((prev) => prev + emoji);
    inputRef.current?.focus();
  }

  /** Send draft when connected; Enter submits, Shift+Enter newline. */
  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
    setEmojiOpen(false);
  }

  /** Enter sends; Shift+Enter inserts a newline. */
  function onComposeKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  /** Switch emoji category tab (ignored after drag-scroll). */
  function selectEmojiCategory(label: string) {
    if (categoryDragRef.current.suppressClick) return;
    setEmojiCategory(label);
  }

  /** Toggle expanded sheet vs compact header bar. */
  function toggleExpanded() {
    setExpanded((open) => {
      if (open) setEmojiOpen(false);
      return !open;
    });
  }

  return (
    <div
      ref={panelRef}
      className={`chat-panel glass-panel-strong absolute z-20 min-h-0 overflow-hidden text-zinc-100 shadow-2xl ${expanded ? "chat-panel--expanded" : "chat-panel--collapsed"}`}
      role="region"
      aria-label="Chat"
      aria-expanded={expanded}
    >
      <div className="chat-panel-handle mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-700 md:hidden" />

      <header className="chat-panel-header flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 text-lg ring-1 ring-white/10">
            👤
          </div>
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">Stranger</p>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span
                className={`status-dot ${connected ? "status-dot--live" : "status-dot--pending"}`}
                aria-hidden
              />
              {statusLabel}
              {!expanded && messages.length > 0 && (
                <span className="chat-panel-collapsed-hint">
                  · {messages.length} msg{messages.length === 1 ? "" : "s"}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="chat-panel-header-actions flex shrink-0 items-center gap-2">
          <div className="chat-panel-header-actions-primary flex items-center gap-2">
            <button
              type="button"
              onClick={onStartVideo}
              disabled={!connected || videoBusy}
              className="btn-ghost chat-panel-action-btn flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-60"
              title="Start video"
            >
              <span aria-hidden>📹</span>
              <span className="chat-panel-action-label">Video</span>
            </button>
            <button
              type="button"
              onClick={onGhost}
              disabled={!connected}
              className="btn-ghost chat-panel-action-btn flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-60 disabled:hover:text-zinc-400"
              title="End chat and hide this stranger for the rest of your session"
            >
              <span aria-hidden>👻</span>
              <span className="chat-panel-action-label">Ghost</span>
            </button>
            <button
              type="button"
              onClick={onEnd}
              className="btn-danger chat-panel-action-btn px-3 py-1.5 text-sm"
            >
              {endLabel}
            </button>
          </div>
          <button
            type="button"
            onClick={toggleExpanded}
            className="chat-panel-toggle"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse chat" : "Expand chat"}
            title={expanded ? "Collapse chat" : "Expand chat"}
          >
            <svg
              className="chat-panel-toggle-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </header>

      <div className="chat-panel__body">
      <div className="chat-messages min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-3xl" aria-hidden>
              👋
            </p>
            <p className="mt-3 text-sm text-zinc-500">
              Say hello — messages are peer-to-peer
            </p>
            <p className="mt-1 text-xs text-zinc-600">and never stored</p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex min-w-0 w-full ${m.mine ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`chat-bubble ${m.mine ? "chat-bubble--mine" : "chat-bubble--theirs"}`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="relative shrink-0 border-t border-white/5">
        {emojiOpen && connected && (
          <div
            ref={pickerRef}
            className="emoji-picker-shell animate-scale-in absolute right-2 bottom-full left-2 mb-2 rounded-2xl"
          >
            <nav
              ref={categoryNavRef}
              className="emoji-category-nav"
              role="tablist"
              aria-label="Emoji categories"
            >
              {CHAT_EMOJI_GROUPS.map((group) => {
                const active = group.label === emojiCategory;
                return (
                  <button
                    key={group.label}
                    type="button"
                    role="tab"
                    data-category={group.label}
                    aria-selected={active}
                    title={group.label}
                    className={`emoji-category-tab ${active ? "emoji-category-tab--active" : ""}`}
                    onClick={() => selectEmojiCategory(group.label)}
                  >
                    <span className="emoji-category-icon" aria-hidden>
                      {group.icon}
                    </span>
                    <span className="emoji-category-name">{group.label}</span>
                  </button>
                );
              })}
            </nav>

            <div
              ref={emojiPanelScrollRef}
              className="emoji-picker-panel"
              role="tabpanel"
              aria-label={activeEmojiGroup.label}
            >
              <p className="emoji-picker-heading">{activeEmojiGroup.label}</p>
              <div className="emoji-picker">
                {activeEmojiGroup.emojis.map((emoji, i) => (
                  <button
                    key={`${activeEmojiGroup.label}-${i}-${emoji}`}
                    type="button"
                    className="emoji-picker-btn"
                    onClick={() => insertEmoji(emoji)}
                    aria-label={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={submit}
          className="flex items-end gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            data-emoji-toggle
            onClick={() => setEmojiOpen((o) => !o)}
            disabled={!connected}
            className={`emoji-toggle-btn disabled:opacity-35 ${emojiOpen ? "emoji-toggle-btn--active" : ""}`}
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
          >
            😊
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onComposeKeyDown}
            placeholder={
              connected
                ? "Type a message…"
                : phase === "waiting"
                  ? "Waiting for stranger to accept…"
                  : "Connecting…"
            }
            disabled={!connected}
            aria-label="Message"
            className="chat-compose-input min-w-0 flex-1 rounded-2xl border border-white/5 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/30 disabled:opacity-45"
          />
          <button
            type="submit"
            disabled={!connected || !draft.trim()}
            className="btn-pulse px-5 py-2.5 text-sm disabled:opacity-35"
          >
            Send
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
