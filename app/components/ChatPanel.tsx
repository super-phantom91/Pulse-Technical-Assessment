"use client";

import { useEffect, useRef, useState } from "react";

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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div
      className="animate-slide-up-sheet md:animate-slide-in-right glass-panel-strong absolute inset-x-0 bottom-0 z-20 flex max-h-[58vh] flex-col rounded-t-3xl text-zinc-100 shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:max-w-md md:rounded-none md:rounded-l-3xl md:border-l md:border-t-0"
      role="region"
      aria-label="Chat"
    >
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-700 md:hidden" />

      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 ring-1 ring-white/10">
            <svg
              className="h-5 w-5 text-zinc-400"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
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
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
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

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-zinc-500">
              Say hello — messages are peer-to-peer
            </p>
            <p className="mt-1 text-xs text-zinc-600">and never stored</p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
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

      <form
        onSubmit={submit}
        className="flex gap-2 border-t border-white/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Type a message…" : "Connecting…"}
          disabled={!connected}
          className="flex-1 rounded-2xl border border-white/5 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/30 disabled:opacity-45"
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
  );
}
