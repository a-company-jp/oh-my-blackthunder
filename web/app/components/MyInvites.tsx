"use client";

// Pending team invites for the signed-in user (GET /api/me/invites). Each can
// be accepted (POST /api/teams/[id]/accept), which joins the team. Hidden when
// there are no pending invites.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { ApiError, acceptInvite, listMyInvites } from "@/lib/client/api";
import type { TeamInviteDoc } from "@/lib/shared/schema";

export function MyInvites() {
  const router = useRouter();
  const { user, getIdToken } = useAuth();
  const [invites, setInvites] = useState<TeamInviteDoc[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { invites } = await listMyInvites(getIdToken);
      setInvites(invites.filter((i) => i.status === "pending"));
    } catch {
      // Quietly degrade — invites are non-critical chrome.
      setInvites([]);
    }
  }, [user, getIdToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAccept(invite: TeamInviteDoc) {
    setBusyId(invite.teamId);
    setError(null);
    try {
      const { team } = await acceptInvite(getIdToken, invite.teamId);
      setInvites((cur) => cur?.filter((i) => i.teamId !== invite.teamId) ?? null);
      router.push(`/teams/${team.slug}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "招待の承認に失敗しました。もう一度お試しください。",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!user || invites === null || invites.length === 0) return null;

  return (
    <section className="bt-panel p-5">
      <h2 className="mb-3 font-display text-lg font-extrabold text-thunder-yellow">
        ✉️ 招待が届いています
      </h2>
      {error ? (
        <p role="alert" className="mb-2 text-sm font-bold text-thunder-red">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {invites.map((invite) => (
          <li
            key={invite.teamId}
            className="flex items-center gap-3 rounded-xl border-2 border-thunder-black bg-thunder-black/40 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-white">{invite.teamName}</p>
              <p className="truncate text-xs text-white/50">
                @{invite.invitedByLogin} さんからの招待
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleAccept(invite)}
              disabled={busyId === invite.teamId}
              className="bt-button shrink-0 px-4 py-2 text-sm"
            >
              {busyId === invite.teamId ? "承認中…" : "参加"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
