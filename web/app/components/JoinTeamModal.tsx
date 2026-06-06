"use client";

// Modal form to join a team by invite code (POST /api/teams/join). On success,
// navigates to the joined team page.
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { ApiError, joinTeam } from "@/lib/client/api";

export function JoinTeamModal({
  onClose,
  initialCode = "",
}: {
  onClose: () => void;
  initialCode?: string;
}) {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const titleId = useId();
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("招待コードを入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { team } = await joinTeam(getIdToken, trimmed);
      onClose();
      router.push(`/teams/${team.slug}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "チームへの参加に失敗しました。コードを確認してください。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="bt-modal-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal aria-labelledby={titleId} className="bt-modal">
        <h2
          id={titleId}
          className="mb-4 font-display text-xl font-extrabold text-thunder-yellow"
        >
          🎟️ コードで参加
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-white/80">招待コード</span>
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="例: ZAKU-1234"
              autoCapitalize="characters"
              className="bt-input font-mono tracking-wider"
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm font-bold text-thunder-red">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-thunder-black px-4 py-2.5 font-display font-bold text-white/70 transition hover:text-white"
            >
              キャンセル
            </button>
            <button type="submit" disabled={busy} className="bt-button">
              {busy ? "参加中…" : "参加する ⚡"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
