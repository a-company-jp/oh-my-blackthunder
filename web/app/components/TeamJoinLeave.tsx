"use client";

// Membership actions on the team page.
//  - Not a member: "コードで参加" (opens the join modal seeded with this team's
//    invite code) + sign-in prompt when signed out.
//  - Member: "脱退" (POST /api/teams/[id]/leave).
//      Owner leaving:
//        - alone: blocked (must delete or stay) — we surface a clear message.
//        - with others: a transfer picker selects the new owner.
import { useState } from "react";

import { JoinTeamModal } from "@/app/components/JoinTeamModal";
import { SignInButton } from "@/app/components/SignInButton";
import { useAuth } from "@/lib/auth-context";
import { ApiError, leaveTeam } from "@/lib/client/api";
import type { TeamDoc, TeamMemberDoc } from "@/lib/shared/schema";

interface TeamJoinLeaveProps {
  team: TeamDoc;
  isMember: boolean;
  isOwner: boolean;
  members: TeamMemberDoc[];
  myUid: string | null;
}

export function TeamJoinLeave({
  team,
  isMember,
  isOwner,
  members,
  myUid,
}: TeamJoinLeaveProps) {
  const { user, getIdToken } = useAuth();
  const [showJoin, setShowJoin] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [transferTo, setTransferTo] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherMembers = members.filter((m) => m.uid !== myUid);
  const ownerAlone = isOwner && otherMembers.length === 0;

  async function handleLeave() {
    if (isOwner && !ownerAlone && !transferTo) {
      setError("オーナーを引き継ぐメンバーを選択してください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await leaveTeam(
        getIdToken,
        team.id,
        isOwner && !ownerAlone ? transferTo : undefined,
      );
      setConfirmingLeave(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "脱退に失敗しました。もう一度お試しください。",
      );
    } finally {
      setBusy(false);
    }
  }

  // Signed out: prompt sign-in to join.
  if (!user) {
    return (
      <div className="flex flex-col items-start gap-2 border-t-2 border-dashed border-white/10 pt-5">
        <p className="text-sm text-white/60">
          サインインすると、このチームに参加できます。
        </p>
        <SignInButton className="text-sm" />
      </div>
    );
  }

  // Member: leave control.
  if (isMember) {
    return (
      <div className="flex flex-col gap-3 border-t-2 border-dashed border-white/10 pt-5">
        {!confirmingLeave ? (
          <button
            type="button"
            onClick={() => {
              setConfirmingLeave(true);
              setError(null);
            }}
            className="self-start rounded-xl border-2 border-thunder-red/60 px-4 py-2 text-sm font-display font-bold text-thunder-red transition hover:bg-thunder-red/10"
          >
            チームを脱退
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border-2 border-thunder-red/40 bg-thunder-red/5 p-4">
            <p className="text-sm font-bold text-white">
              本当にこのチームを脱退しますか?
            </p>

            {ownerAlone ? (
              <p className="text-sm text-thunder-red">
                あなたは唯一のオーナーです。脱退するには、先に別のメンバーを招待してオーナーを引き継いでください。
              </p>
            ) : isOwner ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-white/70">
                  オーナーを引き継ぐメンバー
                </span>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="bt-input"
                >
                  <option value="">選択してください…</option>
                  {otherMembers.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.displayName?.trim() || m.login} (@{m.login})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm font-bold text-thunder-red">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmingLeave(false);
                  setError(null);
                }}
                className="rounded-xl border-2 border-thunder-black px-4 py-2 text-sm font-bold text-white/70 transition hover:text-white"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleLeave}
                disabled={busy || ownerAlone}
                className="bt-button-red px-4 py-2 text-sm"
              >
                {busy ? "処理中…" : "脱退する"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Signed in but not a member: join.
  return (
    <div className="flex flex-col items-start gap-2 border-t-2 border-dashed border-white/10 pt-5">
      <button
        type="button"
        onClick={() => setShowJoin(true)}
        className="bt-button text-sm"
      >
        🎟️ このチームに参加
      </button>
      {showJoin ? (
        <JoinTeamModal
          initialCode={team.inviteCode}
          onClose={() => setShowJoin(false)}
        />
      ) : null}
    </div>
  );
}
