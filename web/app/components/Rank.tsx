"use client";

// Rank glyph: medals for the top 3, "#N" otherwise.
import clsx from "clsx";

const MEDALS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export function Rank({ rank, className }: { rank: number; className?: string }) {
  const medal = MEDALS[rank];
  return (
    <div
      className={clsx(
        "flex w-12 shrink-0 select-none items-center justify-center sm:w-14",
        className,
      )}
      aria-label={`第${rank}位`}
    >
      {medal ? (
        <span className="text-3xl leading-none sm:text-4xl" aria-hidden>
          {medal}
        </span>
      ) : (
        <span className="font-display text-xl font-extrabold text-white/55 sm:text-2xl">
          <span className="text-white/35">#</span>
          {rank}
        </span>
      )}
    </div>
  );
}
