// ============================================================================
// POST /api/ingest — the client-app ingestion endpoint (SERVER, nodejs).
//
// Auth: Authorization: Bearer <app_token>. The token is an OPAQUE, website-
// brokered credential (see /connect + tokens.ts). We hash the bearer, look up
// apiTokens/{sha256(token)}, resolve the user (uid = gh_<githubId>) with NO
// GitHub round-trip, then apply the batch idempotently.
//
//   RunThunder -> bars events (per-device daily cumulative meters).
//   Chrome     -> eat events (the reCAPTCHA-style checkbox).
// ============================================================================

import { NextResponse } from "next/server";

import {
  applyEvents,
  IngestValidationError,
  type IngestIdentity,
} from "@/lib/server/ingest";
import { AppTokenError, verifyAppToken } from "@/lib/server/tokens";
import {
  MAX_EVENTS_PER_REQUEST,
  type IngestRequest,
  type IngestResponse,
} from "@/lib/shared/schema";

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
  const token = bearerToken(req);
  if (!token) {
    return errorResponse(401, "Missing Authorization: Bearer <app_token>");
  }

  // 1. Authenticate via the opaque app token (hashed lookup).
  let identity: IngestIdentity;
  try {
    const resolved = await verifyAppToken(token);
    identity = {
      githubId: resolved.githubId,
      login: resolved.login,
      // The app-token path has no fresh GitHub profile, but the numeric id is a
      // stable handle to the GitHub avatar — so clients that only sync via the
      // app token (e.g. RunThunder) still get an avatar on the web leaderboard.
      displayName: null,
      avatarUrl: `https://avatars.githubusercontent.com/u/${resolved.githubId}`,
    };
  } catch (err) {
    if (err instanceof AppTokenError) {
      return errorResponse(err.status, err.message);
    }
    console.error("[ingest] token verify failed", (err as Error).message);
    return errorResponse(500, "Authentication failed");
  }

  // 2. Parse + validate the request envelope.
  let body: IngestRequest;
  try {
    body = (await req.json()) as IngestRequest;
  } catch {
    return errorResponse(400, "Body must be valid JSON");
  }
  if (typeof body !== "object" || body === null || !Array.isArray(body.events)) {
    return errorResponse(400, "Body must be { client, events: [] }");
  }
  if (body.events.length === 0) {
    return errorResponse(400, "events must be a non-empty array");
  }
  if (body.events.length > MAX_EVENTS_PER_REQUEST) {
    return errorResponse(
      413,
      `Too many events: ${body.events.length} > ${MAX_EVENTS_PER_REQUEST}`,
    );
  }

  // 3. Apply.
  try {
    const { applied, duplicates, user } = await applyEvents(
      identity,
      body.events,
    );

    // Minimal logging — uid + counts only, never the token.
    console.log(
      `[ingest] uid=${user.uid} client=${body.client ?? "?"} applied=${applied} duplicates=${duplicates}`,
    );

    const res: IngestResponse = {
      ok: true,
      uid: user.uid,
      githubId: user.githubId,
      login: user.login,
      applied,
      duplicates,
      totalBars: user.totalBars,
      zakuzakuScore: user.zakuzakuScore,
      blackThunderCount: user.blackThunderCount,
    };
    return NextResponse.json(res, { status: 200 });
  } catch (err) {
    if (err instanceof IngestValidationError) {
      return errorResponse(400, err.message);
    }
    console.error("[ingest] apply failed", (err as Error).message);
    return errorResponse(500, "Failed to apply events");
  }
}
