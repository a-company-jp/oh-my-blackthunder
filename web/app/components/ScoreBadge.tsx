"use client";

// AIザクザク度: formatted bars + the bar-piece glyph + 本 unit.
// Counts up on change and shimmers (animate-zakuzaku, reduced-motion aware).
import Image from "next/image";
import clsx from "clsx";

import { formatBars, useCountUp } from "@/lib/format";

interface ScoreBadgeProps {
  value: number;
  /** sm: leaderboard rows, lg: profile hero. */
  size?: "sm" | "md" | "lg";
  /** Apply the shimmering crunch animation to the number. */
  animate?: boolean;
  showLabel?: boolean;
  className?: string;
}

const SIZES = {
  sm: { num: "text-2xl sm:text-3xl", glyph: 22, unit: "text-sm" },
  md: { num: "text-3xl sm:text-4xl", glyph: 28, unit: "text-base" },
  lg: { num: "text-5xl sm:text-6xl", glyph: 40, unit: "text-xl" },
} as const;

export function ScoreBadge({
  value,
  size = "sm",
  animate = true,
  showLabel = false,
  className,
}: ScoreBadgeProps) {
  const animated = useCountUp(value);
  const s = SIZES[size];

  return (
    <div className={clsx("flex flex-col items-end", className)}>
      {showLabel ? (
        <span className="font-display text-xs font-bold uppercase tracking-wide text-thunder-yellow/80">
          AIザクザク度
        </span>
      ) : null}
      <div className="flex items-baseline gap-1.5">
        <Image
          src="/assets/product/bar-piece.png"
          alt=""
          width={s.glyph}
          height={s.glyph}
          className="translate-y-1 select-none drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]"
          aria-hidden
        />
        <span
          className={clsx(
            "bt-stroke font-display font-extrabold tabular-nums text-thunder-yellow",
            s.num,
            animate && "animate-zakuzaku",
          )}
        >
          {formatBars(animated)}
        </span>
        <span className={clsx("font-display font-bold text-thunder-yellow/90", s.unit)}>
          本
        </span>
      </div>
    </div>
  );
}
