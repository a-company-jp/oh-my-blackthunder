"use client";

// Rounded horizontal usage bar (track + fill), in the spirit of RunThunder's
// UsageBarView. `fraction` is clamped 0..1; the fill animates its width.
import clsx from "clsx";

interface UsageBarProps {
  fraction: number;
  className?: string;
  /** Tailwind background class for the fill (defaults to thunder yellow). */
  fillClass?: string;
}

export function UsageBar({
  fraction,
  className,
  fillClass = "bg-thunder-yellow",
}: UsageBarProps) {
  const pct = Math.min(100, Math.max(0, fraction * 100));
  return (
    <div
      className={clsx(
        "h-2.5 w-full overflow-hidden rounded-full bg-thunder-black/60",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        className={clsx(
          "h-full rounded-full transition-[width] duration-500",
          fillClass,
        )}
        style={{ width: `${Math.max(pct === 0 ? 0 : 6, pct)}%` }}
      />
    </div>
  );
}
