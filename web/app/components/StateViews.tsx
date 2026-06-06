"use client";

// Reusable Thunder-styled loading / empty / error blocks.
import { MascotEmpty, type Mascot } from "@/app/components/MascotEmpty";

/** Animated lightning spinner. */
export function Loading({ label = "ザクザク読み込み中…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center"
    >
      <span className="bt-spinner" aria-hidden />
      <p className="font-display text-lg font-bold text-thunder-yellow">{label}</p>
    </div>
  );
}

/** Empty state with a mascot. */
export function Empty({
  mascot = "niko",
  title,
  subtitle,
  children,
}: {
  mascot?: Mascot;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <MascotEmpty mascot={mascot} title={title} subtitle={subtitle}>
      {children}
    </MascotEmpty>
  );
}

/** Error state with a retry affordance. */
export function ErrorView({
  title = "エラーが発生しました",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <span className="text-5xl" aria-hidden>
        ⚡
      </span>
      <p className="font-display text-xl font-extrabold text-thunder-red">{title}</p>
      {message ? <p className="max-w-md text-sm text-white/60">{message}</p> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="bt-button mt-2">
          もう一度試す
        </button>
      ) : null}
    </div>
  );
}
