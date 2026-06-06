"use client";

// The teams a user belongs to (from UserDoc.teamIds -> team docs). Compact
// chip-style cards linking to each team page.
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatBars } from "@/lib/format";
import { subscribeMyTeams } from "@/lib/client/firestore";
import type { TeamDoc } from "@/lib/shared/schema";

export function UserTeams({ teamIds }: { teamIds: string[] }) {
  const [teams, setTeams] = useState<TeamDoc[] | null>(null);
  // Re-subscribe only when the membership set actually changes.
  const teamKey = teamIds.join(",");

  useEffect(() => {
    const ids = teamKey ? teamKey.split(",") : [];
    const unsub = subscribeMyTeams(ids, (next) => setTeams(next));
    return unsub;
  }, [teamKey]);

  if (teamIds.length === 0) {
    return (
      <section className="bt-panel p-5">
        <h2 className="mb-3 font-display text-lg font-extrabold text-thunder-yellow">
          🤝 チーム
        </h2>
        <p className="text-sm text-white/50">まだチームに参加していません。</p>
        <Link
          href="/teams"
          className="mt-3 inline-block text-sm font-bold text-thunder-yellow transition hover:underline"
        >
          チームを探す →
        </Link>
      </section>
    );
  }

  return (
    <section className="bt-panel p-5">
      <h2 className="mb-3 font-display text-lg font-extrabold text-thunder-yellow">
        🤝 チーム
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
