"use client";

// One leaderboard entry. Detects a live increase in zakuzakuScore /
// blackThunderCount (via a ref of the previous values) and fires a crunch pop
// + CrunchBurst. Top-3 get a yellow gradient border.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { CountBadge } from "@/app/components/CountBadge";
import { CrunchBurst } from "@/app/components/CrunchBurst";
import { Rank } from "@/app/components/Rank";
import { ScoreBadge } from "@/app/components/ScoreBadge";
import type { UserDoc } from "@/lib/shared/schema";

interface LeaderboardRowProps {
  user: UserDoc;
  rank: number;
  highlight?: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Score milestones worth an extra-celebratory burst when first crossed.
const MILESTONE_STEP = 100;

export function LeaderboardRow({ user, rank, highlight = false }: LeaderboardRowProps) {
  const isTop3 = rank <= 3;
  const [burst, setBurst] = useState(0);
  const [pop, setPop] = useState(false);
  const [rankMove, setRankMove] = useState<"up" | "down" | null>(null);
  const [milestone, setMilestone] = useState<string | null>(null);

  const prevRef = useRef<{ score: number; count: number }>({
    score: user.zakuzakuScore,
    count: user.blackThunderCount,
  });
  const prevRankRef = useRef<number>(rank);
  // Skip the burst on first mount (initial snapshot is not an "increase").
  const mountedRef = useRef(false);

  useEffect(() => {
    const prev = prevRef.current;
    const increased =
      user.zakuzakuScore > prev.score || user.blackThunderCount > prev.count;
    prevRef.current = {
      score: user.zakuzakuScore,
      count: user.blackThunderCount,
    };

    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (increased && !prefersReducedMotion()) {
      setBurst((n) => n + 1);
      setPop(true);
      // Crossed a 100-point milestone on this update? Show a bigger label.
      const crossed =
        Math.floor(user.zakuzakuScore / MILESTONE_STEP) >
        Math.floor(prev.score / MILESTONE_STEP);
      if (crossed) {
        const reached =
          Math.floor(user.zakuzakuScore / MILESTONE_STEP) * MILESTONE_STEP;
        setMilestone(`⚡${reached}本 達成！`);
      }
      const t = setTimeout(() => {
        setPop(false);
        setMilestone(null);
      }, 760);
      return () => clearTimeout(t);
    }
  }, [user.zakuzakuScore, user.blackThunderCount]);

  // Rank-change motion: lift on improvement, settle on demotion.
  useEffect(() => {
    const prevRank = prevRankRef.current;
    prevRankRef.current = rank;
    if (prevRank === rank || prefersReducedMotion()) return;
    const dir = rank < prevRank ? "up" : "down";
    setRankMove(dir);
    const t = setTimeout(() => setRankMove(null), 650);
    return () => clearTimeout(t);
  }, [rank]);

  const displayName = user.displayName?.trim() || user.login;

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
        <CrunchBurst trigger={burst} label={milestone ?? undefined} />
        <Rank rank={rank} />

        <Link
          href={`/u/${user.login}`}
          className="flex min-w-0 flex-1 items-center gap-3 transition hover:brightness-110"
        >
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt=""
              width={44}
              height={44}
              className={clsx(
                "shrink-0 rounded-full border-2",
                isTop3 ? "border-thunder-yellow" : "border-thunder-black",
              )}
            />
          ) : (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-thunder-black bg-thunder-black">
              ⚡
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-display font-extrabold leading-tight text-white">
              {displayName}
            </p>
            <p className="truncate text-sm text-white/55">@{user.login}</p>
          </div>
        </Link>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <ScoreBadge value={user.zakuzakuScore} size="sm" />
          <CountBadge value={user.blackThunderCount} size="sm" />
        </div>
      </div>
    </li>
  );
}
