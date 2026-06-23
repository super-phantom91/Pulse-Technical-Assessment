"use client";

import { useEffect, useRef, useState } from "react";
import { CHAT_EMOJI_GROUPS } from "@/lib/chat-emojis";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  onSend,
  onStartVideo,
  onEnd,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  function insertEmoji(emoji: string) {
    setDraft((prev) => prev + emoji);
    inputRef.current?.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
    setEmojiOpen(false);
  }

  return (
    <div
      className="animate-slide-up-sheet md:animate-slide-in-right glass-panel-strong absolute inset-x-0 bottom-0 z-20 flex max-h-[58vh] min-h-0 flex-col overflow-hidden rounded-t-3xl text-zinc-100 shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:max-w-md md:rounded-none md:rounded-l-3xl md:border-l md:border-t-0"
      role="region"
      aria-label="Chat"
    >
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-700 md:hidden" />

      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 text-lg ring-1 ring-white/10">
            👤
          </div>
          <div>
            <p className="font-semibold tracking-tight">Stranger</p>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span
                className={`status-dot ${connected ? "status-dot--live" : "status-dot--connecting"}`}
                aria-hidden
              />
              {connected ? "Connected" : "Connecting…"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
            className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-35"
            title="Start video"
          >
            <span aria-hidden>📹</span>
            Video
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="btn-danger px-3 py-1.5 text-sm"
          >
            End
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-4 py-4">
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
            className="animate-scale-in glass-panel absolute right-2 bottom-full left-2 mb-2 max-h-[min(50vh,20rem)] overflow-y-auto rounded-2xl shadow-xl"
            role="listbox"
            aria-label="Insert emoji"
          >
            {CHAT_EMOJI_GROUPS.map((group) => (
              <div key={group.label} className="emoji-picker-section">
                <p className="emoji-picker-label">{group.label}</p>
                <div className="emoji-picker">
                  {group.emojis.map((emoji, i) => (
                    <button
                      key={`${group.label}-${i}-${emoji}`}
                      type="button"
                      role="option"
                      className="emoji-picker-btn"
                      onClick={() => insertEmoji(emoji)}
                      aria-label={`Insert ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={submit}
          className="flex gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
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
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={connected ? "Type a message…" : "Connecting…"}
            disabled={!connected}
            className="min-w-0 flex-1 rounded-2xl border border-white/5 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/30 disabled:opacity-45"
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
  );
}
