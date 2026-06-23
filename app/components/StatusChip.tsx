"use client";

/** Floating toast for notices and in-progress states. */
export default function StatusChip({
  children,
  action,
  onAction,
  variant = "default",
}: {
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
  variant?: "default" | "notice";
}) {
  return (
    <div
      className={`animate-toast-in glass-panel-strong absolute left-1/2 z-30 flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 text-sm text-zinc-100 shadow-2xl ${
        variant === "notice" ? "top-6" : "top-20"
      }`}
    >
      {variant === "default" && (
        <span className="status-dot status-dot--connecting" aria-hidden />
      )}
      <span className="flex-1">{children}</span>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn-ghost shrink-0 px-3 py-1 text-xs font-medium"
        >
          {action}
        </button>
      )}
    </div>
  );
}
