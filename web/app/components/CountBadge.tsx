"use client";

// ブラックサンダーカウント: how many times the user declared eating one.
import clsx from "clsx";

import { useCountUp } from "@/lib/format";

interface CountBadgeProps {
  value: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const SIZES = {
  sm: { num: "text-lg sm:text-xl", emoji: "text-base", unit: "text-xs" },
  md: { num: "text-2xl sm:text-3xl", emoji: "text-xl", unit: "text-sm" },
  lg: { num: "text-4xl sm:text-5xl", emoji: "text-3xl", unit: "text-lg" },
} as const;

export function CountBadge({
  value,
  size = "sm",
  showLabel = false,
  className,
}: CountBadgeProps) {
  const animated = useCountUp(value);
  const s = SIZES[size];
  const display = Math.round(animated);

  return (
    <div className={clsx("flex flex-col items-end", className)}>
      {showLabel ? (
        <span className="font-display text-xs font-bold uppercase tracking-wide text-choco-light">
          ブラックサンダーカウント
        </span>
      ) : null}
      <div className="flex items-baseline gap-1">
        <span className={clsx("select-none", s.emoji)} aria-hidden>
          🍫
        </span>
        <span
          className={clsx(
            "font-display font-extrabold tabular-nums text-white",
            s.num,
          )}
        >
          {display.toLocaleString("ja-JP")}
        </span>
        <span className={clsx("font-display font-bold text-white/70", s.unit)}>回</span>
      </div>
    </div>
  );
}
