"use client";

import { useState } from "react";
import { getUserLocation } from "@/lib/geo";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => void | Promise<void>;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");

  async function enter() {
    setStatus("locating");
    setError("");
    try {
      const coords = await getUserLocation();
      await onReady(coords.latitude, coords.longitude);
    } catch (err) {
      setStatus("error");
      const code = (err as GeolocationPositionError).code;
      if (code === 0) {
        setError("Your browser doesn't support location access.");
      } else if (code === 1) {
        setError("Location permission is required to place you on the map.");
      } else if (code === 2 || code === 3) {
        setError("Couldn't get your location. Please try again.");
      } else {
        setError("Couldn't enter Pulse. Please try again.");
      }
    }
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden p-6 text-zinc-100">
      <div className="aurora-bg" aria-hidden />

      <div className="relative z-10 flex max-w-md flex-col items-center gap-10 text-center">
        <div className="animate-fade-up flex flex-col items-center gap-6">
          <div className="pulse-orb" aria-hidden>
            <span className="pulse-orb-ring" />
            <span className="pulse-orb-ring" />
            <span className="pulse-orb-ring" />
            <span className="pulse-orb-core" />
          </div>

          <div>
            <h1 className="bg-gradient-to-br from-white via-zinc-100 to-emerald-200/80 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
              Pulse
            </h1>
            <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:text-lg">
              A living globe of anonymous strangers.
              <br />
              <span className="text-zinc-500">Drop onto the map and connect.</span>
            </p>
          </div>
        </div>

        <div className="animate-fade-up-delay-2 flex w-full flex-col items-center gap-4">
          <button
            type="button"
            onClick={enter}
            disabled={status === "locating"}
            className="btn-pulse w-full max-w-xs px-10 py-3.5 text-base sm:w-auto"
          >
            {status === "locating" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="status-dot status-dot--connecting" />
                Locating you…
              </span>
            ) : (
              "Enter Pulse"
            )}
          </button>

          {status === "error" && (
            <p className="animate-scale-in text-sm text-red-400/90">{error}</p>
          )}
        </div>

        <p className="animate-fade-up-delay-3 max-w-xs text-xs leading-relaxed text-zinc-600">
          No sign-up. Your dot is placed 1–3&nbsp;km from your real location.
          Nothing is stored — closing the tab ends everything.
        </p>
      </div>
    </div>
  );
}
