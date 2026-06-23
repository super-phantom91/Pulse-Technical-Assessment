"use client";

import { useEffect, useRef } from "react";

export default function VideoPanel({
  localStream,
  remoteStream,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localRef.current.srcObject !== localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteRef.current.srcObject !== remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="animate-fade-up absolute inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70"
          aria-hidden
        />

        {!remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <span className="status-dot status-dot--connecting" />
            <p className="text-sm">Waiting for stranger&apos;s video…</p>
          </div>
        )}

        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="absolute right-4 bottom-24 h-36 w-28 rounded-2xl border border-white/15 bg-zinc-900 object-cover shadow-2xl ring-1 ring-white/10 sm:bottom-28 sm:h-44 sm:w-32"
        />
      </div>

      <div className="glass-panel-strong flex justify-center border-t border-white/5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onEnd} className="btn-danger px-10 py-3">
          End video
        </button>
      </div>
    </div>
  );
}
