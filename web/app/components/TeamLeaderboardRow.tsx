"use client";

// One team leaderboard entry. Mirrors LeaderboardRow: detects a live increase
// in totalBars / totalBlackThunderCount and fires a crunch pop + CrunchBurst,
// animates rank changes, and gives the top-3 a yellow gradient frame. Links to
// the team page by slug; shows BOTH metrics (AIザクザク度 + カウント).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { CountBadge } from "@/app/components/CountBadge";
import { CrunchBurst } from "@/app/components/CrunchBurst";
import { Rank } from "@/app/components/Rank";
import { ScoreBadge } from "@/app/components/ScoreBadge";
import type { TeamDoc } from "@/lib/shared/schema";

interface TeamLeaderboardRowProps {
  team: TeamDoc;
  rank: number;
  highlight?: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TeamLeaderboardRow({
  team,
  rank,
  highlight = false,
}: TeamLeaderboardRowProps) {
  const isTop3 = rank <= 3;
  const [burst, setBurst] = useState(0);
  const [pop, setPop] = useState(false);
  const [rankMove, setRankMove] = useState<"up" | "down" | null>(null);

  const prevRef = useRef<{ bars: number; count: number }>({
    bars: team.totalBars,
    count: team.totalBlackThunderCount,
  });
  const prevRankRef = useRef<number>(rank);
  const mountedRef = useRef(false);

  useEffect(() => {
    const prev = prevRef.current;
    const increased =
      team.totalBars > prev.bars ||
      team.totalBlackThunderCount > prev.count;
    prevRef.current = {
      bars: team.totalBars,
      count: team.totalBlackThunderCount,
    };
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (increased && !prefersReducedMotion()) {
      setBurst((n) => n + 1);
      setPop(true);
      const t = setTimeout(() => setPop(false), 460);
      return () => clearTimeout(t);
    }
  }, [team.totalBars, team.totalBlackThunderCount]);

  useEffect(() => {
    const prevRank = prevRankRef.current;
    prevRankRef.current = rank;
    if (prevRank === rank || prefersReducedMotion()) return;
    const dir = rank < prevRank ? "up" : "down";
    setRankMove(dir);
    const t = setTimeout(() => setRankMove(null), 650);
    return () => clearTimeout(t);
  }, [rank]);

  return (
    <li
      className={clsx(
        "relative transition-transform",
        isTop3 && "bt-top3-frame rounded-2xl p-[2px]",
        rankMove === "up" && "animate-rankUp",
        rankMove === "down" && "animate-rankDown",
      )}
    >
      <div
        className={clsx(
          "bt-panel relative flex items-center gap-3 overflow-visible px-3 py-3 sm:gap-4 sm:px-4",
          pop && "animate-crunchPop",
          highlight && "ring-2 ring-thunder-yellow",
        )}
      >
        <CrunchBurst trigger={burst} label="チームザクザク!" />
        <Rank rank={rank} />

        <Link
          href={`/teams/${team.slug}`}
          className="flex min-w-0 flex-1 items-center gap-3 transition hover:brightness-110"
        >
          <span
            className={clsx(
              "grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-xl",
              isTop3 ? "border-thunder-yellow" : "border-thunder-black",
              "bg-thunder-black",
            )}
            aria-hidden
          >
            {team.emoji ?? "⚡"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display font-extrabold leading-tight text-white">
              {team.name}
            </p>
            <p className="truncate text-sm text-white/55">
              👥 {team.memberCount}人
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <ScoreBadge value={team.totalBars} size="sm" />
          <CountBadge value={team.totalBlackThunderCount} size="sm" />
        </div>
      </div>
    </li>
  );
}
