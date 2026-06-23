"use client";

import { FLARES, type FlareIntent } from "@/lib/flare";

/** Intent picker shown before sending a connection request. */
export default function FlarePicker({
  onSelect,
  onCancel,
}: {
  onSelect: (intent: FlareIntent) => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[45] flex items-end justify-center bg-black/45 p-4 backdrop-blur-md sm:items-center">
      <div
        className="animate-scale-in flare-picker glass-panel-strong w-full max-w-md rounded-3xl p-6 text-zinc-100 shadow-2xl sm:p-8"
        role="dialog"
        aria-modal
        aria-labelledby="flare-picker-title"
      >
        <p className="text-xs font-medium tracking-[0.14em] text-emerald-400/80 uppercase">
          Signal flare
        </p>
        <h2 id="flare-picker-title" className="mt-1 text-xl font-semibold tracking-tight">
          How do you want to reach out?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Choose an intent — your stranger sees it before they accept. No names, just
          tone.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {FLARES.map((flare) => (
            <button
              key={flare.id}
              type="button"
              onClick={() => onSelect(flare.id)}
              className="flare-picker-card group"
              style={
                {
                  "--flare-hue": flare.hue,
                } as React.CSSProperties
              }
            >
              <span className="flare-picker-card-emoji" aria-hidden>
                {flare.emoji}
              </span>
              <span className="flare-picker-card-label">{flare.label}</span>
              <span className="flare-picker-card-tagline">{flare.tagline}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost mt-5 w-full py-2.5 text-sm text-zinc-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
