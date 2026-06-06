// ============================================================================
// GitHub token verification (SERVER-ONLY).
//
// The CLI/extension ingestion path authenticates with a raw GitHub OAuth token.
// We verify it by calling GET https://api.github.com/user and trust the numeric
// `id` as the stable identity (uid = gh_<id>). A tiny in-memory cache (keyed by
// sha256(token), 60s TTL) bounds the number of upstream calls under bursts.
// ============================================================================

import { createHash } from "node:crypto";

/** Identity resolved from a GitHub token. */
export interface GithubIdentity {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string;
}

/**
 * Typed error for GitHub verification failures. `status` carries the HTTP status
 * the API route should surface (401 for bad/expired token, 429 for rate limit,
 * 502 for upstream/transport problems).
 */
export class GithubAuthError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GithubAuthError";
    this.status = status;
  }
}

interface CacheEntry {
  expiresAtMs: number;
  identity: GithubIdentity;
}

const CACHE_TTL_MS = 60_000;
const tokenCache = new Map<string, CacheEntry>();

function cacheKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Coerce the GitHub /user payload into our identity shape, validating shape. */
function toIdentity(payload: unknown): GithubIdentity {
  if (typeof payload !== "object" || payload === null) {
    throw new GithubAuthError("GitHub returned an unexpected response", 502);
  }
  const p = payload as Record<string, unknown>;
  const githubId = typeof p.id === "number" ? p.id : Number(p.id);
  const login = typeof p.login === "string" ? p.login : "";
  if (!Number.isFinite(githubId) || githubId <= 0 || login.length === 0) {
    throw new GithubAuthError("GitHub identity missing id/login", 502);
  }
  return {
    githubId,
    login,
    name: typeof p.name === "string" && p.name.length > 0 ? p.name : null,
    avatarUrl: typeof p.avatar_url === "string" ? p.avatar_url : "",
  };
}

/**
 * Verify a GitHub bearer token and resolve the caller's identity.
 *
 * @throws {GithubAuthError} 401 invalid/expired, 429 rate-limited, 502 upstream.
 */
export async function verifyGithubToken(token: string): Promise<GithubIdentity> {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    throw new GithubAuthError("Empty GitHub token", 401);
  }

  const key = cacheKey(trimmed);
  const now = Date.now();
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAtMs > now) {
    return cached.identity;
  }
  // Drop a stale entry eagerly.
  if (cached) tokenCache.delete(key);

  let res: Response;
  try {
    res = await fetch("https://api.github.com/user", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "zakuzaku-web",
      },
      // No Next.js caching — this is an auth call.
      cache: "no-store",
    });
  } catch (err) {
    throw new GithubAuthError(
      `Failed to reach GitHub: ${(err as Error).message}`,
      502,
    );
  }

  if (res.status === 401) {
    throw new GithubAuthError("Invalid or expired GitHub token", 401);
  }
  if (res.status === 403 || res.status === 429) {
    // GitHub signals primary/secondary rate limiting with 403 (remaining 0) or
    // 429. Surface as 429 so the client can back off.
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (res.status === 429 || remaining === "0") {
      throw new GithubAuthError("GitHub API rate limit exceeded", 429);
    }
    throw new GithubAuthError("GitHub rejected the token", 401);
  }
  if (!res.ok) {
    throw new GithubAuthError(
      `GitHub /user returned HTTP ${res.status}`,
      502,
    );
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new GithubAuthError("GitHub returned malformed JSON", 502);
  }

  const identity = toIdentity(payload);
  tokenCache.set(key, { expiresAtMs: now + CACHE_TTL_MS, identity });
  return identity;
}
