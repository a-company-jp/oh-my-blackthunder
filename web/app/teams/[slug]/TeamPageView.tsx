"use client";

// Team detail page. Resolves the team by slugLower, then renders:
//  - team totals (AIザクザク度 + ブラックサンダーカウント) hero
//  - the live member roster (subscribe teams/{id}/members, ordered by bars)
//  - membership actions: join (by code), leave, and (members) the invite UI
//    (copy invite link/code + invite-by-username).
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CountBadge } from "@/app/components/CountBadge";
import { Rank } from "@/app/components/Rank";
import { ScoreBadge } from "@/app/components/ScoreBadge";
import { Empty, ErrorView, Loading } from "@/app/components/StateViews";
import { TeamInvitePanel } from "@/app/components/TeamInvitePanel";
import { TeamJoinLeave } from "@/app/components/TeamJoinLeave";
import { useAuth } from "@/lib/auth-context";
import { relativeTimeJa } from "@/lib/format";
import {
  subscribeTeamBySlug,
  subscribeTeamMembers,
} from "@/lib/client/firestore";
import {
  uidForGithubId,
  type TeamDoc,
  type TeamMemberDoc,
} from "@/lib/shared/schema";

export function TeamPageView({ slug }: { slug: string }) {
  const { githubId } = useAuth();
  const [team, setTeam] = useState<TeamDoc | null | undefined>(undefined);
  const [members, setMembers] = useState<TeamMemberDoc[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const slugLower = slug.toLowerCase();

  useEffect(() => {
    setError(null);
    setTeam(undefined);
    setMembers(null);
    const unsub = subscribeTeamBySlug(
      slugLower,
      (next) => setTeam(next),
      (e) => setError(e),
    );
    return unsub;
  }, [slugLower]);

  const teamId = team?.id ?? null;
  useEffect(() => {
    if (!teamId) return;
    const unsub = subscribeTeamMembers(
      teamId,
      (next) => setMembers(next),
      (e) => setError(e),
    );
    return unsub;
  }, [teamId]);

  const myUid = githubId != null ? uidForGithubId(githubId) : null;
  const myMembership = useMemo(
    () => (members && myUid ? members.find((m) => m.uid === myUid) ?? null : null),
    [members, myUid],
  );
  const isMember = myMembership != null;
  const isOwner = team != null && myUid != null && team.ownerUid === myUid;

  if (error) {
    return (
      <ErrorView
        title="チームを読み込めませんでした"
        message={error.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (team === undefined) {
    return <Loading label="チームを取得中…" />;
  }

  if (team === null) {
    return (
      <Empty
        mascot="wi"
        title="チームが見つかりません"
        subtitle="このチームは存在しないか、URLが間違っている可能性があります。"
      >
        <Link href="/teams" className="bt-button mt-2">
          チーム一覧へ
        </Link>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/teams"
          className="text-sm font-bold text-white/50 transition hover:text-thunder-yellow"
        >
          ← チーム一覧へ戻る
        </Link>
      </div>

      {/* Team hero */}
      <section className="bt-panel relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-thunder-radial opacity-60" />
        <div className="relative flex flex-col gap-6 p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <span
              className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-2 border-thunder-yellow bg-thunder-black text-4xl shadow-thunder-yellow"
              aria-hidden
            >
              {team.emoji ?? "⚡"}
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">
                {team.name}
              </h1>
              <p className="text-sm text-white/55">👥 {team.memberCount}人</p>
              {team.description ? (
                <p className="mt-1 text-sm text-white/65">{team.description}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border-2 border-thunder-black bg-thunder-black/40 p-4">
              <ScoreBadge
                value={team.totalBars}
                size="lg"
                showLabel
                className="items-start"
              />
              <p className="mt-1 text-xs text-white/45">チーム合計のザクザク度</p>
            </div>
            <div className="rounded-2xl border-2 border-thunder-black bg-thunder-black/40 p-4">
              <CountBadge
                value={team.totalBlackThunderCount}
                size="lg"
                showLabel
                className="items-start"
              />
              <p className="mt-1 text-xs text-white/45">チーム合計の食べた回数</p>
            </div>
          </div>

          <TeamJoinLeave
            team={team}
            isMember={isMember}
            isOwner={isOwner}
            members={members ?? []}
            myUid={myUid}
          />
        </div>
      </section>

      {/* Invite UI (members only) */}
      {isMember ? <TeamInvitePanel team={team} /> : null}

      {/* Member roster */}
      <section className="bt-panel p-5">
        <h2 className="mb-4 font-display text-lg font-extrabold text-thunder-yellow">
          🏅 メンバー
        </h2>
        {members === null ? (
          <Loading label="メンバーを取得中…" />
        ) : members.length === 0 ? (
          <p className="text-sm text-white/50">まだメンバーがいません。</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {members.map((m, i) => (
              <li
                key={m.uid}
                className="flex items-center gap-3 rounded-xl border-2 border-thunder-black bg-thunder-black/40 px-3 py-2"
              >
                <Rank rank={i + 1} className="!w-9" />
                <Link
                  href={`/u/${m.login}`}
                  className="flex min-w-0 flex-1 items-center gap-3 transition hover:brightness-110"
                >
                  {m.avatarUrl ? (
                    <Image
                      src={m.avatarUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="shrink-0 rounded-full border-2 border-thunder-black"
                    />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-thunder-black bg-thunder-black">
                      ⚡
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-bold text-white">
                        {m.displayName?.trim() || m.login}
                      </span>
                      {m.role === "owner" ? (
                        <span className="bt-chip border-thunder-yellow/60 bg-thunder-yellow/15 text-[0.65rem] text-thunder-yellow">
                          👑 オーナー
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-white/50">
                      @{m.login} · {relativeTimeJa(m.joinedAtMs)}参加
                    </span>
                  </span>
                </Link>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <ScoreBadge value={m.bars} size="sm" animate={false} />
                  <CountBadge value={m.blackThunderCount} size="sm" />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
