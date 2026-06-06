"use client";

// "ブラックサンダーを食べた！" declaration button.
//
// POSTs to /api/eat with the Firebase id token as a Bearer auth header. The
// server authors the eat event itself (source "web", unique eventId); the body
// only carries optional display fields (login/displayName/avatarUrl) for the
// public upsert. Optimistic: bumps the displayed count immediately and fires a
// crunch burst; rolls back on a failed response. The server is the source of
// truth (idempotency via users/{uid}/events/{eventId}), so the live Firestore
// subscription always reconciles to the canonical count.

import { useCallback, useRef, useState } from "react";

import { CrunchBurst } from "@/app/components/CrunchBurst";
import { useAuth } from "@/lib/auth-context";

interface EatButtonProps {
  /** Optional callback to drive an optimistic count in the parent. */
  onOptimistic?: (delta: number) => void;
  className?: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function EatButton({ onOptimistic, className }: EatButtonProps) {
  const { getIdToken, login, displayName, avatarUrl } = useAuth();
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleEat = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);

    // Optimistic UI: pop + burst + bump now.
    if (!prefersReducedMotion()) {
      setBurst((n) => n + 1);
      const el = btnRef.current;
      if (el) {
        el.classList.remove("animate-crunchPop");
        // force reflow so the animation can replay
        void el.offsetWidth;
        el.classList.add("animate-crunchPop");
      }
    }
    onOptimistic?.(1);

    try {
      const token = await getIdToken();
      if (!token) {
        onOptimistic?.(-1);
        setMessage("サインインが必要です。");
        return;
      }

      const res = await fetch("/api/eat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // Untrusted display fields only; the server authors the eat event and
        // derives identity from the verified token.
        body: JSON.stringify({
          login: login ?? undefined,
          displayName: displayName ?? undefined,
          avatarUrl: avatarUrl ?? undefined,
        }),
      });

      if (!res.ok) {
        onOptimistic?.(-1);
        setMessage(
          res.status === 401
            ? "認証に失敗しました。もう一度サインインしてください。"
            : "登録に失敗しました。もう一度お試しください。",
        );
        return;
      }
      // Success: the live Firestore subscription will reconcile the canonical
      // count; the optimistic +1 stays consistent with it.
      setMessage("ザクザク！記録しました ⚡");
    } catch {
      onOptimistic?.(-1);
      setMessage("通信エラーが発生しました。");
    } finally {
      setBusy(false);
    }
  }, [busy, getIdToken, onOptimistic, login, displayName, avatarUrl]);

  return (
    <div className="relative inline-flex flex-col items-center gap-2">
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          onClick={handleEat}
          disabled={busy}
          className={`bt-button-red text-base ${className ?? ""}`}
        >
          ブラックサンダーを食べた！⚡
        </button>
        <CrunchBurst trigger={burst} />
      </div>
      {message ? (
        <p role="status" className="text-xs font-bold text-thunder-yellow">
          {message}
        </p>
      ) : null}
    </div>
  );
}
