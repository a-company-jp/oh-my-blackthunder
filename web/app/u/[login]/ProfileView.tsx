"use client";

// Client profile view for /u/[login], redesigned in the RunThunder dashboard
// taste: a hero with big metric tiles + compact stat tiles, a provider
// breakdown (rounded bars), a daily sparkline + history, the user's devices,
// and the user's teams. The EatButton shows to the profile owner.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { DeviceList } from "@/app/components/DeviceList";
import { ProfileActivity } from "@/app/components/ProfileActivity";
import { ProfileCard } from "@/app/components/ProfileCard";
import { ProviderBreakdown } from "@/app/components/ProviderBreakdown";
import { Empty, ErrorView, Loading } from "@/app/components/StateViews";
import { UserTeams } from "@/app/components/UserTeams";
import { useAuth } from "@/lib/auth-context";
import { subscribeProfileByLogin } from "@/lib/client/firestore";
import type { UserDoc } from "@/lib/shared/schema";

export function ProfileView({ login }: { login: string }) {
  const { login: viewerLogin } = useAuth();
  const [user, setUser] = useState<UserDoc | null | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [countDelta, setCountDelta] = useState(0);

  const loginLower = login.toLowerCase();
  // Last canonical count we observed; when the live count rises, the server
  // write landed so we drop the matching optimistic delta to avoid double count.
  const lastCanonicalRef = useRef<number | null>(null);

  useEffect(() => {
    setError(null);
    setUser(undefined);
    setCountDelta(0);
    lastCanonicalRef.current = null;
    const unsub = subscribeProfileByLogin(
      loginLower,
      (next) => {
        setUser(next);
        if (next) {
          const prev = lastCanonicalRef.current;
          if (prev != null && next.blackThunderCount > prev) {
            const landed = next.blackThunderCount - prev;
            setCountDelta((d) => Math.max(0, d - landed));
          }
          lastCanonicalRef.current = next.blackThunderCount;
        }
      },
      (e) => setError(e),
    );
    return unsub;
  }, [loginLower]);

  if (error) {
    return (
      <ErrorView
        title="プロフィールを読み込めませんでした"
        message={error.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (user === undefined) {
    return <Loading label="プロフィールを取得中…" />;
  }

  if (user === null) {
    return (
      <Empty
        mascot="wi"
        title={`@${login} はまだザクザクしていません`}
        subtitle="このユーザーはまだランキングに登場していません。"
      >
        <Link href="/leaderboard" className="bt-button mt-2">
          ランキングへ戻る
        </Link>
      </Empty>
    );
  }

  const isOwner =
    viewerLogin != null && viewerLogin.toLowerCase() === user.loginLower;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/leaderboard"
          className="text-sm font-bold text-white/50 transition hover:text-thunder-yellow"
        >
          ← ランキングへ戻る
        </Link>
      </div>

      <ProfileCard
        user={user}
        isOwner={isOwner}
        countDelta={countDelta}
        onOptimisticEat={(delta) => setCountDelta((c) => c + delta)}
      />

      <ProfileActivity uid={user.uid} days={30} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProviderBreakdown user={user} />
        <DeviceList uid={user.uid} />
      </div>

      <UserTeams teamIds={user.teamIds} />
    </div>
  );
}
