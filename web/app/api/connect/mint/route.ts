// ============================================================================
// POST /api/connect/mint — broker an opaque client app token (SERVER, nodejs).
//
// The /connect PAGE (frontend slice) authenticates the user via Firebase (GitHub
// provider), then POSTs here with { app, redirect_uri, state }. We:
//   1. verify the Firebase ID token,
//   2. STRICTLY validate redirect_uri against the loopback + chromiumapp.org
//      allowlist (this is the security boundary — an open redirect here would
//      leak the minted token),
//   3. mint a token (same logic as POST /api/tokens),
//   4. return { redirectUrl } = redirect_uri?token=...&state=... for the page to
//      navigate to.
// ============================================================================

import { NextResponse } from "next/server";

import { FirebaseAuthError, verifyFirebaseUser } from "@/lib/server/auth";
import { AppTokenError, isClientApp, mintToken, resolveLogin } from "@/lib/server/tokens";
import type { ClientApp } from "@/lib/shared/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Validate a client redirect target. ONLY two shapes are allowed:
 *   - Desktop loopback:  http://127.0.0.1[:port][/path]  or
 *                        http://localhost[:port][/path]
 *   - Chrome extension:  https://<id>.chromiumapp.org[/path]
 * Everything else (other hosts, other schemes, credentials, non-loopback http)
 * is rejected to prevent token exfiltration via an open redirect.
 */
function isAllowedRedirectUri(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  // Never allow embedded credentials.
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase();

  // Desktop loopback over plain http only (any port, any path; no query/hash
  // restriction needed — we append our own params).
  if (url.protocol === "http:") {
    return host === "127.0.0.1" || host === "localhost";
  }

  // Chrome extension callback over https only: https://<id>.chromiumapp.org/*
  // (a non-empty subdomain is required; the bare apex is not a valid callback).
  if (url.protocol === "https:") {
    return host.endsWith(".chromiumapp.org") && host !== ".chromiumapp.org";
  }

  return false;
}

/** Append token + state (+ identity) to the (already-validated) redirect URI. */
function buildRedirectUrl(
  redirectUri: string,
  token: string,
  state: string | undefined,
  identity: { githubId: number; login: string },
): string {
  const url = new URL(redirectUri);
  url.searchParams.set("token", token);
  if (typeof state === "string" && state.length > 0) {
    url.searchParams.set("state", state);
  }
  // Pass the signed-in identity along so the client can show the avatar/name
  // immediately, without waiting for the first /api/ingest round-trip.
  url.searchParams.set("github_id", String(identity.githubId));
  url.searchParams.set("login", identity.login);
  return url.toString();
}

export async function POST(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await verifyFirebaseUser(bearerToken(req));
  } catch (err) {
    if (err instanceof FirebaseAuthError) return errorResponse(err.status, err.message);
    return errorResponse(500, "Authentication failed");
  }

  let body: {
    app?: unknown;
    redirect_uri?: unknown;
    state?: unknown;
    label?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return errorResponse(400, "Body must be valid JSON");
  }

  if (!isClientApp(body.app)) {
    return errorResponse(400, "app must be one of the known client apps");
  }
  if (!isAllowedRedirectUri(body.redirect_uri)) {
    return errorResponse(400, "redirect_uri is not on the allowlist");
  }
  const state = typeof body.state === "string" ? body.state : undefined;
  const label = typeof body.label === "string" ? body.label : null;

  const login = await resolveLogin(user.uid, user.login);
  try {
    const minted = await mintToken(
      user.uid,
      { githubId: user.githubId, login },
      body.app as ClientApp,
      label,
    );
    const redirectUrl = buildRedirectUrl(body.redirect_uri, minted.token, state, {
      githubId: user.githubId,
      login,
    });
    return NextResponse.json({ redirectUrl }, { status: 200 });
  } catch (err) {
    if (err instanceof AppTokenError) return errorResponse(err.status, err.message);
    console.error("[connect/mint] failed", (err as Error).message);
    return errorResponse(500, "Failed to mint token");
  }
}
