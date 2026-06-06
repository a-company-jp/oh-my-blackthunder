"use client";

// ---------------------------------------------------------------------------
// Typed fetch helpers for the browser-authed JSON API.
//
// Every mutation goes through a firebase-admin Route Handler that expects
// `Authorization: Bearer <FirebaseIdToken>`. These helpers take a token
// provider (typically `getIdToken` from the auth context), attach the bearer,
// parse the JSON, and turn non-2xx responses into a typed ApiError carrying the
// server's JA message so callers can surface it directly.
//
// The shapes mirror the frozen API contract in the spec; request/response
// types reuse the shared schema where possible.
// ---------------------------------------------------------------------------

import type {
  ClientApp,
  TeamDoc,
  TeamInviteDoc,
} from "@/lib/shared/schema";

/** A token provider, e.g. `getIdToken` from useAuth(). */
export type TokenProvider = () => Promise<string | null>;

/** Error thrown for non-2xx responses (or a missing token). */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ErrorBody {
  error?: unknown;
  message?: unknown;
}

function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const b = body as ErrorBody;
    if (typeof b.error === "string" && b.error.length > 0) return b.error;
    if (typeof b.message === "string" && b.message.length > 0) return b.message;
  }
  return fallback;
}

async function authedFetch<T>(
  getToken: TokenProvider,
  path: string,
  init: { method: string; body?: unknown } = { method: "GET" },
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new ApiError("サインインが必要です。", 401);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("通信エラーが発生しました。接続を確認してください。", 0);
  }

  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(
      messageFromBody(
        parsed,
        res.status === 401
          ? "認証に失敗しました。もう一度サインインしてください。"
          : "リクエストに失敗しました。もう一度お試しください。",
      ),
      res.status,
    );
  }

  return parsed as T;
}

// --- Eat -------------------------------------------------------------------

export interface EatResponse {
  ok: boolean;
  uid: string;
  login: string;
  blackThunderCount: number;
}

export function eat(
  getToken: TokenProvider,
  body: { login?: string; displayName?: string; avatarUrl?: string } = {},
): Promise<EatResponse> {
  return authedFetch<EatResponse>(getToken, "/api/eat", {
    method: "POST",
    body,
  });
}

// --- Teams -----------------------------------------------------------------

export function createTeam(
  getToken: TokenProvider,
  body: { name: string; emoji?: string; description?: string },
): Promise<{ team: TeamDoc }> {
  return authedFetch<{ team: TeamDoc }>(getToken, "/api/teams", {
    method: "POST",
    body,
  });
}

export function joinTeam(
  getToken: TokenProvider,
  code: string,
): Promise<{ team: TeamDoc }> {
  return authedFetch<{ team: TeamDoc }>(getToken, "/api/teams/join", {
    method: "POST",
    body: { code },
  });
}

export function inviteToTeam(
  getToken: TokenProvider,
  teamId: string,
  login: string,
): Promise<{ ok: boolean }> {
  return authedFetch<{ ok: boolean }>(
    getToken,
    `/api/teams/${encodeURIComponent(teamId)}/invite`,
    { method: "POST", body: { login } },
  );
}

export function acceptInvite(
  getToken: TokenProvider,
  teamId: string,
): Promise<{ team: TeamDoc }> {
  return authedFetch<{ team: TeamDoc }>(
    getToken,
    `/api/teams/${encodeURIComponent(teamId)}/accept`,
    { method: "POST" },
  );
}

export function leaveTeam(
  getToken: TokenProvider,
  teamId: string,
  transferToUid?: string,
): Promise<{ ok: boolean }> {
  return authedFetch<{ ok: boolean }>(
    getToken,
    `/api/teams/${encodeURIComponent(teamId)}/leave`,
    {
      method: "POST",
      body: transferToUid ? { transferToUid } : {},
    },
  );
}

// --- Invites ---------------------------------------------------------------

export function listMyInvites(
  getToken: TokenProvider,
): Promise<{ invites: TeamInviteDoc[] }> {
  return authedFetch<{ invites: TeamInviteDoc[] }>(
    getToken,
    "/api/me/invites",
    { method: "GET" },
  );
}

// --- API tokens ------------------------------------------------------------

export interface MintTokenResponse {
  token: string; // opaque, shown ONCE
  app: ClientApp;
  label: string | null;
}

export function mintToken(
  getToken: TokenProvider,
  body: { app: ClientApp; label?: string },
): Promise<MintTokenResponse> {
  return authedFetch<MintTokenResponse>(getToken, "/api/tokens", {
    method: "POST",
    body,
  });
}

export interface ApiTokenSummary {
  app: ClientApp;
  label: string | null;
  createdAtMs: number;
  lastUsedAtMs: number | null;
  revoked: boolean;
}

export function listTokens(
  getToken: TokenProvider,
): Promise<{ tokens: ApiTokenSummary[] }> {
  return authedFetch<{ tokens: ApiTokenSummary[] }>(getToken, "/api/tokens", {
    method: "GET",
  });
}

export function revokeToken(
  getToken: TokenProvider,
  tokenId: string,
): Promise<{ ok: boolean }> {
  return authedFetch<{ ok: boolean }>(getToken, "/api/tokens", {
    method: "DELETE",
    body: { tokenId },
  });
}

// --- Connect (token mint for desktop / extension clients) ------------------

export interface MintConnectResponse {
  redirectUrl: string;
}

export function mintConnect(
  getToken: TokenProvider,
  body: { app: ClientApp; redirect_uri: string; state?: string },
): Promise<MintConnectResponse> {
  return authedFetch<MintConnectResponse>(getToken, "/api/connect/mint", {
    method: "POST",
    body,
  });
}
