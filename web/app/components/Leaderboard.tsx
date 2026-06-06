"use client";

// Live leaderboard: subscribes to the top-N users ordered by zakuzakuScore.
import { useEffect, useState } from "react";

import { LeaderboardRow } from "@/app/components/LeaderboardRow";
import { Empty, ErrorView, Loading } from "@/app/components/StateViews";
import { useAuth } from "@/lib/auth-context";
import { subscribeLeaderboard } from "@/lib/client/firestore";
import type { UserDoc } from "@/lib/shared/schema";

export function Leaderboard({ topN = 50 }: { topN?: number }) {
  const { login } = useAuth();
  const [users, setUsers] = useState<UserDoc[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setError(null);
    const unsub = subscribeLeaderboard(
      topN,
      (next) => setUsers(next),
      (e) => setError(e),
    );
    return unsub;
  }, [topN]);

  if (error) {
    return (
      <ErrorView
        title="ランキングを読み込めませんでした"
        message={error.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (users === null) {
    return <Loading label="ランキングをザクザク取得中…" />;
  }

  if (users.length === 0) {
    return (
      <Empty
        mascot="niko"
        title="まだ誰もザクザクしていません"
        subtitle="AIを使ってブラックサンダーをザクザク消費したり、食べた回数を記録すると、ここに登場します。"
      />
    );
  }

  const myLoginLower = login?.toLowerCase() ?? null;

  return (
    <ol className="flex flex-col gap-3">
      {users.map((user, i) => (
        <LeaderboardRow
          key={user.uid}
          user={user}
          rank={i + 1}
          highlight={myLoginLower != null && user.loginLower === myLoginLower}
        />
      ))}
    </ol>
  );
}
