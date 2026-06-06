"use client";

// Invite UI for team members: copy the invite link / code, and invite a GitHub
// user by username (POST /api/teams/[id]/invite). The invite link deep-links to
// /teams/[slug] where the recipient can join (the join modal is seeded with the
// team's code).
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { ApiError, inviteToTeam } from "@/lib/client/api";
import type { TeamDoc } from "@/lib/shared/schema";

export function TeamInvitePanel({ team }: { team: TeamDoc }) {
  const { getIdToken } = useAuth();
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/teams/${team.slug}`
      : `/teams/${team.slug}`;

  async function copy(text: string, which: "link" | "code") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 1600);
    } catch {
      setError("コピーに失敗しました。手動でコピーしてください。");
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const login = username.trim().replace(/^@/, "");
    if (!login) {
      setError("GitHubユーザー名を入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await inviteToTeam(getIdToken, team.id, login);
      setMessage(`@${login} さんを招待しました ⚡`);
      setUsername("");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "招待に失敗しました。もう一度お試しください。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bt-panel p-5">
      <h2 className="mb-4 font-display text-lg font-extrabold text-thunder-yellow">
        ✉️ メンバーを招待
      </h2>

      <div className="flex flex-col gap-4">
        {/* Copy link / code */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-white/50">
              招待リンク
            </span>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl border-2 border-thunder-black bg-thunder-black/50 px-3 py-2 text-sm text-white/80">
                {inviteLink}
              </code>
              <button
                type="button"
                onClick={() => copy(inviteLink, "link")}
                className="bt-button shrink-0 px-3 py-2 text-sm"
              >
                {copied === "link" ? "コピー済" : "コピー"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-white/50">
              招待コード
            </span>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl border-2 border-thunder-black bg-thunder-black/50 px-3 py-2 font-mono text-sm tracking-wider text-thunder-yellow">
                {team.inviteCode}
              </code>
              <button
                type="button"
                onClick={() => copy(team.inviteCode, "code")}
                className="bt-button shrink-0 px-3 py-2 text-sm"
              >
                {copied === "code" ? "コピー済" : "コピー"}
              </button>
            </div>
          </div>
        </div>

        {/* Invite by username */}
        <form
          onSubmit={handleInvite}
          className="flex flex-col gap-2 border-t-2 border-dashed border-white/10 pt-4"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-white/50">
            ユーザー名で招待
          </span>
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border-2 border-thunder-black bg-thunder-black/50 px-3">
              <span className="text-white/40">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="github-username"
                className="w-full bg-transparent py-2.5 text-white placeholder:text-white/30 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="bt-button shrink-0 text-sm"
            >
              {busy ? "招待中…" : "招待"}
            </button>
          </div>
          {message ? (
            <p role="status" className="text-sm font-bold text-thunder-yellow">
              {message}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm font-bold text-thunder-red">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
