"use client";

// Modal form to create a team (POST /api/teams). On success, navigates to the
// new team page. Closes on Escape / backdrop click. Locked to the signed-in
// user (the caller only renders it for authed users).
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { ApiError, createTeam } from "@/lib/client/api";

const EMOJI_CHOICES = ["⚡", "🍫", "🔥", "🚀", "💛", "🦾", "🧠", "🐉", "✨", "🥇"];

export function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const titleId = useId();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>("⚡");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("チーム名を入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { team } = await createTeam(getIdToken, {
        name: trimmed,
        emoji,
        description: description.trim() || undefined,
      });
      onClose();
      router.push(`/teams/${team.slug}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "チームの作成に失敗しました。もう一度お試しください。",
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
          🤝 チームを作成
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-white/80">チーム名</span>
            <input
              ref={nameRef}
              type="text"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="ザクザク開発部"
              className="bt-input"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-white/80">アイコン</span>
            <div className="flex flex-wrap gap-2">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  aria-pressed={emoji === e}
                  className={`grid h-10 w-10 place-items-center rounded-xl border-2 text-xl transition ${
                    emoji === e
                      ? "border-thunder-yellow bg-thunder-yellow/20"
                      : "border-thunder-black bg-thunder-black/40 hover:brightness-125"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-white/80">
              説明 <span className="font-normal text-white/40">(任意)</span>
            </span>
            <textarea
              value={description}
              maxLength={140}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="どんなチーム?"
              className="bt-input resize-none"
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
              {busy ? "作成中…" : "作成する ⚡"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
