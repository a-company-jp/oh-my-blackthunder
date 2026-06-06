"use client";

// /connect — the website-brokered token authorization flow for client apps
// (RunThunder / Chrome / VS Code / JetBrains / zsh).
//
// Query: app, redirect_uri, state. Requires GitHub sign-in. On Authorize we
// POST /api/connect/mint with the Firebase ID token; the server mints + stores a
// hashed app token (same logic as POST /api/tokens) and returns a redirectUrl
// (redirect_uri?token=...&state=...). We then hand the browser over to it.
//
// SECURITY: we ALSO validate redirect_uri client-side (mirroring the server)
// so we never even render an Authorize button for a disallowed target. Allowed:
//   - http://127.0.0.1[:port][/path] and http://localhost[:port][/path] (loopback)
//   - https://*.chromiumapp.org/* (chrome identity)
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { SignInButton } from "@/app/components/SignInButton";
import { useAuth } from "@/lib/auth-context";
import { ApiError, mintConnect } from "@/lib/client/api";
import type { ClientApp } from "@/lib/shared/schema";

const APP_META: Record<ClientApp, { label: string; emoji: string }> = {
  runthunder: { label: "RunThunder", emoji: "🖥️" },
  chrome: { label: "ThunderCaptcha (Chrome 拡張)", emoji: "🌐" },
  vscode: { label: "VS Code 拡張", emoji: "🧩" },
  jetbrains: { label: "JetBrains プラグイン", emoji: "🧠" },
  zsh: { label: "oh-my-blackthunder (zsh)", emoji: "⌨️" },
  other: { label: "クライアントアプリ", emoji: "📦" },
};

const VALID_APPS = new Set<ClientApp>([
  "runthunder",
  "chrome",
  "vscode",
  "jetbrains",
  "zsh",
  "other",
]);

/** Mirror of the server's redirect_uri allowlist. */
function isAllowedRedirect(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  // Chrome identity API.
  if (
    url.protocol === "https:" &&
    (url.hostname === "chromiumapp.org" ||
      url.hostname.endsWith(".chromiumapp.org"))
  ) {
    return true;
  }
  // Desktop loopback.
  if (
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost")
  ) {
    return true;
  }
  return false;
}

export function ConnectView() {
  const params = useSearchParams();
  const { user, loading, getIdToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appParam = params.get("app");
  const redirectUri = params.get("redirect_uri") ?? "";
  const state = params.get("state") ?? undefined;

  const app = useMemo<ClientApp | null>(() => {
    if (appParam && VALID_APPS.has(appParam as ClientApp)) {
      return appParam as ClientApp;
    }
    return null;
  }, [appParam]);

  const redirectOk = useMemo(
    () => (redirectUri ? isAllowedRedirect(redirectUri) : false),
    [redirectUri],
  );

  async function handleAuthorize() {
    if (!app || !redirectOk) return;
    setBusy(true);
    setError(null);
    try {
      const { redirectUrl } = await mintConnect(getIdToken, {
        app,
        redirect_uri: redirectUri,
        state,
      });
      window.location.assign(redirectUrl);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "連携に失敗しました。もう一度お試しください。",
      );
      setBusy(false);
    }
  }

  // --- Invalid request states ----------------------------------------------
  if (!app) {
    return (
      <Shell>
        <h1 className="font-display text-xl font-extrabold text-thunder-red">
          無効な連携リクエスト
        </h1>
        <p className="text-sm text-white/60">
          アプリの指定が正しくありません。クライアントアプリからもう一度お試しください。
        </p>
      </Shell>
    );
  }

  if (!redirectUri || !redirectOk) {
    return (
      <Shell app={app}>
        <h1 className="font-display text-xl font-extrabold text-thunder-red">
          リダイレクト先が許可されていません
        </h1>
        <p className="text-sm text-white/60">
          安全のため、このリダイレクト先には連携できません。クライアントアプリの設定をご確認ください。
        </p>
        {redirectUri ? (
          <code className="block break-all rounded-xl border-2 border-thunder-black bg-thunder-black/50 px-3 py-2 text-xs text-white/50">
            {redirectUri}
          </code>
        ) : null}
      </Shell>
    );
  }

  const meta = APP_META[app];

  // --- Auth gate ------------------------------------------------------------
  if (loading) {
    return (
      <Shell app={app}>
        <span className="bt-spinner" aria-hidden />
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell app={app}>
        <h1 className="font-display text-xl font-extrabold text-white">
          <span aria-hidden>{meta.emoji}</span> {meta.label} を連携しますか?
        </h1>
        <p className="text-sm text-white/60">
          連携を続けるには、まず GitHub でサインインしてください。
        </p>
        <SignInButton />
      </Shell>
    );
  }

  // --- Authorize ------------------------------------------------------------
  return (
    <Shell app={app}>
      <h1 className="font-display text-xl font-extrabold text-white">
        <span aria-hidden>{meta.emoji}</span> {meta.label} を連携しますか?
      </h1>
      <p className="text-sm text-white/60">
        <span className="font-bold text-thunder-yellow">{meta.label}</span>{" "}
        が、あなたのAIザクザク度を記録できるようになります。許可すると、専用のアクセストークンが発行されます。
      </p>

      {error ? (
        <p role="alert" className="text-sm font-bold text-thunder-red">
          {error}
        </p>
      ) : null}

      <div className="flex w-full gap-2 pt-1">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex-1 rounded-xl border-2 border-thunder-black px-4 py-3 font-display font-bold text-white/70 transition hover:text-white"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleAuthorize}
          disabled={busy}
          className="bt-button flex-1"
        >
          {busy ? "連携中…" : "許可する ⚡"}
        </button>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  app,
}: {
  children: React.ReactNode;
  app?: ClientApp;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center">
      <div className="bt-panel relative w-full overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-thunder-radial opacity-50" />
        <div className="relative flex flex-col items-center gap-4 text-center">
          <Image
            src="/assets/logo/blackthunder-wordmark.png"
            alt="Black Thunder"
            width={200}
            height={44}
            priority
            className="h-9 w-auto animate-boltDrop"
          />
          {app ? (
            <span className="bt-chip border-thunder-yellow/50 bg-thunder-yellow/10 text-xs text-thunder-yellow">
              アプリ連携
            </span>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
