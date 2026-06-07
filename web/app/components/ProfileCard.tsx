"use client";

// Profile hero in the RunThunder dashboard taste: avatar + handle, two big
// metric tiles (AIザクザク度 + ブラックサンダーカウント), a row of compact stat
// tiles (devices / teams / events), and the EatButton for the profile owner.
import Image from "next/image";

import { CountBadge } from "@/app/components/CountBadge";
import { EatButton } from "@/app/components/EatButton";
import { ScoreBadge } from "@/app/components/ScoreBadge";
import { relativeTimeJa } from "@/lib/format";
import { displayNameFor, isRealLogin, type UserDoc } from "@/lib/shared/schema";

interface ProfileCardProps {
  user: UserDoc;
  isOwner: boolean;
  /** Optional optimistic-count delta from the EatButton. */
  countDelta?: number;
  onOptimisticEat?: (delta: number) => void;
}

function StatTile({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border-2 border-thunder-black bg-thunder-black/40 px-2 py-3 text-center">
      <span className="text-lg" aria-hidden>
        {emoji}
      </span>
      <span className="font-display text-lg font-extrabold tabular-nums text-white">
        {value}
      </span>
      <span className="text-[0.65rem] font-bold uppercase tracking-wide text-white/45">
        {label}
      </span>
    </div>
  );
}

export function ProfileCard({
  user,
  isOwner,
  countDelta = 0,
  onOptimisticEat,
}: ProfileCardProps) {
  const displayName = displayNameFor(user);

  return (
    <section className="bt-panel relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-thunder-radial opacity-60" />
      <div className="relative flex flex-col gap-6 p-5 sm:p-7">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt=""
              width={80}
              height={80}
              priority
              className="shrink-0 rounded-2xl border-2 border-thunder-yellow shadow-thunder-yellow"
            />
          ) : (
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-2 border-thunder-yellow bg-thunder-black text-3xl">
              ⚡
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">
              {displayName}
            </h1>
            {isRealLogin(user.login) ? (
              <a
                href={`https://github.com/${user.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base text-white/60 transition hover:text-thunder-yellow"
              >
                @{user.login}
              </a>
            ) : null}
            <p className="mt-1 text-xs text-white/40">
              最終アクティビティ: {relativeTimeJa(user.lastEventAtMs)}
            </p>
          </div>
        </div>

        {/* Two big metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-thunder-black bg-thunder-black/40 p-4">
            <ScoreBadge
              value={user.zakuzakuScore}
              size="lg"
              showLabel
              className="items-start"
            />
            <p className="mt-1 text-xs text-white/45">
              AI利用で消費したブラックサンダー
            </p>
          </div>
          <div className="rounded-2xl border-2 border-thunder-black bg-thunder-black/40 p-4">
            <CountBadge
              value={user.blackThunderCount + countDelta}
              size="lg"
              showLabel
              className="items-start"
            />
            <p className="mt-1 text-xs text-white/45">「食べた！」と宣言した回数</p>
          </div>
        </div>

        {/* Compact stat tiles */}
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            emoji="🖥️"
            label="デバイス"
            value={user.deviceCount.toLocaleString("ja-JP")}
          />
          <StatTile
            emoji="🤝"
            label="チーム"
            value={user.teamIds.length.toLocaleString("ja-JP")}
          />
          <StatTile
            emoji="📊"
            label="イベント"
            value={user.totalEvents.toLocaleString("ja-JP")}
          />
        </div>

        {isOwner ? (
          <div className="flex flex-col items-center gap-2 border-t-2 border-dashed border-white/10 pt-5">
            <EatButton onOptimistic={onOptimisticEat} />
            <p className="text-xs text-white/40">
              いま食べた1個を、あなたのカウントに⚡
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
