// ============================================================================
// /api/tokens — manage website-brokered client app tokens (SERVER, nodejs).
//
// Auth: Authorization: Bearer <firebase_id_token>.
//   POST   mint a new opaque token            -> { token (once), app, label }
//   GET    list the caller's tokens           -> { tokens: [...] } (never raw)
//   DELETE revoke a token by its doc id        -> { ok }
// ============================================================================

import { NextResponse } from "next/server";

import { FirebaseAuthError, verifyFirebaseUser } from "@/lib/server/auth";
import {
  AppTokenError,
  isClientApp,
  listTokens,
  mintToken,
  resolveLogin,
  revokeToken,
} from "@/lib/server/tokens";
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

export async function POST(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await verifyFirebaseUser(bearerToken(req));
  } catch (err) {
    if (err instanceof FirebaseAuthError) return errorResponse(err.status, err.message);
    return errorResponse(500, "Authentication failed");
  }

  let body: { app?: unknown; label?: unknown };
  try {
    body = (await req.json()) as { app?: unknown; label?: unknown };
  } catch {
    return errorResponse(400, "Body must be valid JSON");
  }
  if (!isClientApp(body.app)) {
    return errorResponse(400, "app must be one of the known client apps");
  }
  const label =
    typeof body.label === "string" ? body.label : null;

  try {
    const login = await resolveLogin(user.uid, user.login);
    const minted = await mintToken(
      user.uid,
      { githubId: user.githubId, login },
      body.app as ClientApp,
      label,
    );
    return NextResponse.json(
      { token: minted.token, app: minted.app, label: minted.label },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AppTokenError) return errorResponse(err.status, err.message);
    console.error("[tokens] mint failed", (err as Error).message);
    return errorResponse(500, "Failed to mint token");
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await verifyFirebaseUser(bearerToken(req));
  } catch (err) {
    if (err instanceof FirebaseAuthError) return errorResponse(err.status, err.message);
    return errorResponse(500, "Authentication failed");
  }

  try {
    const tokens = await listTokens(user.uid);
    return NextResponse.json({ tokens }, { status: 200 });
  } catch (err) {
    console.error("[tokens] list failed", (err as Error).message);
    return errorResponse(500, "Failed to list tokens");
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await verifyFirebaseUser(bearerToken(req));
  } catch (err) {
    if (err instanceof FirebaseAuthError) return errorResponse(err.status, err.message);
    return errorResponse(500, "Authentication failed");
  }

  let body: { tokenId?: unknown };
  try {
    body = (await req.json()) as { tokenId?: unknown };
  } catch {
    return errorResponse(400, "Body must be valid JSON");
  }
  if (typeof body.tokenId !== "string" || body.tokenId.trim().length === 0) {
    return errorResponse(400, "tokenId is required");
  }

  try {
    const ok = await revokeToken(user.uid, body.tokenId);
    if (!ok) return errorResponse(404, "Token not found");
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof AppTokenError) return errorResponse(err.status, err.message);
    console.error("[tokens] revoke failed", (err as Error).message);
    return errorResponse(500, "Failed to revoke token");
  }
}
