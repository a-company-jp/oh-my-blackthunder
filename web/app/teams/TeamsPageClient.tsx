"use client";

// Teams landing: create / join actions, the signed-in user's invites + teams,
// and the live team leaderboard. Sign-in is required only for the actions;
// the leaderboard is public.
import { useState } from "react";

import { CreateTeamModal } from "@/app/components/CreateTeamModal";
import { JoinTeamModal } from "@/app/components/JoinTeamModal";
import { MyInvites } from "@/app/components/MyInvites";
import { MyTeamsPanel } from "@/app/components/MyTeamsPanel";
import { SignInButton } from "@/app/components/SignInButton";
import { TeamLeaderboard } from "@/app/components/TeamLeaderboard";
import { useAuth } from "@/lib/auth-context";

export function TeamsPageClient() {
  const { user, loading } = useAuth();
  const [modal, setModal] = useState<"create" | "join" | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <header className="bt-panel relative overflow-hidden p-5 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-thunder-radial opacity-60"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="bt-stroke font-display text-2xl font-extrabold text-thunder-yellow sm:text-3xl">
              🤝 チーム
            </h1>
            <p className="mt-1 max-w-md text-sm text-white/65">
              仲間とチームを組んで、合計のAIザクザク度を競おう。
            </p>
          </div>

          {loading ? (
            <span className="bt-spinner-sm" aria-hidden />
          ) : user ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setModal("create")}
                className="bt-button text-sm"
              >
                ＋ チームを作成
              </button>
              <button
                type="button"
                onClick={() => setModal("join")}
                className="bt-button-red text-sm"
              >
                🎟️ コードで参加
              </button>
            </div>
          ) : (
            <div className="shrink-0">
              <SignInButton className="text-sm" />
            </div>
          )}
        </div>
      </header>

      {user ? (
        <>
          <MyInvites />
          <MyTeamsPanel />
        </>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold text-white">
            🏆 チームランキング
          </h2>
          <span className="bt-chip border-thunder-yellow/60 bg-thunder-yellow/10 text-thunder-yellow">
            <span className="h-2 w-2 animate-ping rounded-full bg-thunder-yellow" />
            LIVE
          </span>
        </div>
        <TeamLeaderboard topN={50} />
      </section>

      {modal === "create" ? (
        <CreateTeamModal onClose={() => setModal(null)} />
      ) : null}
      {modal === "join" ? (
        <JoinTeamModal onClose={() => setModal(null)} />
      ) : null}
    </div>
  );
}
