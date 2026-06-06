"use client";

// Live team leaderboard: subscribes to the top-N teams ordered by totalBars.
import { useEffect, useMemo, useState } from "react";

import { Empty, ErrorView, Loading } from "@/app/components/StateViews";
import { TeamLeaderboardRow } from "@/app/components/TeamLeaderboardRow";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeProfileByUid,
  subscribeTeamLeaderboard,
} from "@/lib/client/firestore";
import { uidForGithubId, type TeamDoc } from "@/lib/shared/schema";

export function TeamLeaderboard({ topN = 50 }: { topN?: number }) {
  const { githubId } = useAuth();
  const [teams, setTeams] = useState<TeamDoc[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [myTeamIds, setMyTeamIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setError(null);
    const unsub = subscribeTeamLeaderboard(
      topN,
      (next) => setTeams(next),
      (e) => setError(e),
    );
    return unsub;
  }, [topN]);

  // Track the viewer's own teams so we can highlight them in the list.
  useEffect(() => {
    if (githubId == null) {
      setMyTeamIds(new Set());
      return;
    }
    const uid = uidForGithubId(githubId);
    const unsub = subscribeProfileByUid(uid, (user) => {
      setMyTeamIds(new Set(user?.teamIds ?? []));
    });
    return unsub;
  }, [githubId]);

  const highlightIds = useMemo(() => myTeamIds, [myTeamIds]);

  if (error) {
    return (
      <ErrorView
        title="チームランキングを読み込めませんでした"
        message={error.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (teams === null) {
    return <Loading label="チームをザクザク取得中…" />;
  }

  if (teams.length === 0) {
    return (
      <Empty
        mascot="gusu"
        title="まだチームがありません"
        subtitle="最初のチームを作って、仲間とAIザクザク度を競いましょう。"
      />
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {teams.map((team, i) => (
        <TeamLeaderboardRow
          key={team.id}
          team={team}
          rank={i + 1}
          highlight={highlightIds.has(team.id)}
        />
      ))}
    </ol>
  );
}
