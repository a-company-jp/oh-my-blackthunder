"use client";

// "My teams" panel for the teams page: resolves the signed-in user's teamIds
// (subscribe users/{uid}) then their team docs (subscribe in [teamIds]).
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatBars } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeMyTeams,
  subscribeProfileByUid,
} from "@/lib/client/firestore";
import { uidForGithubId, type TeamDoc } from "@/lib/shared/schema";

export function MyTeamsPanel() {
  const { githubId } = useAuth();
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<TeamDoc[] | null>(null);

  useEffect(() => {
    if (githubId == null) {
      setTeamIds([]);
      setTeams([]);
      return;
    }
    const uid = uidForGithubId(githubId);
    const unsub = subscribeProfileByUid(uid, (user) => {
      setTeamIds(user?.teamIds ?? []);
    });
    return unsub;
  }, [githubId]);

  const teamKey = teamIds.join(",");
  useEffect(() => {
    const ids = teamKey ? teamKey.split(",") : [];
    const unsub = subscribeMyTeams(ids, (next) => setTeams(next));
    return unsub;
  }, [teamKey]);

  if (githubId == null) return null;

  return (
    <section className="bt-panel p-5">
      <h2 className="mb-3 font-display text-lg font-extrabold text-thunder-yellow">
        🤝 あなたのチーム
      </h2>
      {teams === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl bg-thunder-black/40"
            />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <p className="text-sm text-white/50">
          まだチームに参加していません。チームを作成するか、招待コードで参加しましょう。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {teams.map((t) => (
            <li key={t.id}>
              <Link
                href={`/teams/${t.slug}`}
                className="flex items-center gap-3 rounded-xl border-2 border-thunder-black bg-thunder-black/40 px-3 py-2 transition hover:brightness-110"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-thunder-black bg-thunder-black text-lg"
                  aria-hidden
                >
                  {t.emoji ?? "⚡"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-white">
                    {t.name}
                  </span>
                  <span className="block text-xs text-white/50">
                    👥 {t.memberCount}人
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-sm">
                  <span className="font-display font-extrabold text-thunder-yellow">
                    {formatBars(t.totalBars)}
                  </span>
                  <span className="text-white/50"> 本</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
