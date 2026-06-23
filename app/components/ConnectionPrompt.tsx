"use client";

import { flareMeta, type FlareIntent } from "@/lib/flare";

/** Accept/decline modal for connection and video requests. */
export default function ConnectionPrompt({
  title,
  subtitle,
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
  icon = "connect",
  flare,
}: {
  title: string;
  subtitle?: string;
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
  icon?: "connect" | "video";
  flare?: FlareIntent | null;
}) {
  const flareStyle = flare
    ? ({ "--flare-hue": flareMeta(flare).hue } as React.CSSProperties)
    : undefined;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-6 backdrop-blur-md">
      <div
        className={`animate-scale-in glass-panel-strong w-full max-w-sm rounded-3xl p-8 text-center text-zinc-100 shadow-2xl ${flare ? "connection-prompt--flare" : ""}`}
        style={flareStyle}
        role="dialog"
        aria-modal
      >
        <div
          className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${flare ? "connection-prompt-flare-icon" : "bg-emerald-500/10 ring-emerald-400/20"}`}
        >
          {flare ? (
            <span className="text-3xl" aria-hidden>
              {flareMeta(flare).emoji}
            </span>
          ) : icon === "video" ? (
            <svg
              className="h-7 w-7 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          ) : (
            <svg
              className="h-7 w-7 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
              />
            </svg>
          )}
        </div>

        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{subtitle}</p>
        )}

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onDecline}
            className="btn-ghost flex-1 px-4 py-2.5 text-sm font-medium"
          >
            {declineLabel}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="btn-pulse flex-1 px-4 py-2.5 text-sm"
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
