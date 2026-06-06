// ============================================================================
// POST /api/eat — the WEB "私はブラックサンダーを食べました" button (SERVER, nodejs).
//
// Auth: Authorization: Bearer <firebase_id_token>. We verify the Firebase ID
// token, extract the GitHub NUMERIC id from the federated identity claims, and
// derive uid = gh_<numericId> — the SAME doc key the CLI path converges on.
//
// The body may carry { login, displayName, avatarUrl } for the public display
// upsert. These are NOT trusted for scoring; the GitHub id from the verified
// token is the only authority for identity.
// ============================================================================

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";

import { adminAuth } from "@/lib/server/firebase-admin";
import { applyEvents, type IngestIdentity } from "@/lib/server/ingest";
import type { IngestEatEvent } from "@/lib/shared/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EatRequestBody {
  login?: unknown;
  displayName?: unknown;
  avatarUrl?: unknown;
}

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
 * Pull the GitHub numeric id out of a verified Firebase ID token. signInWithPopup
 * via the GitHub provider records it under
 * decoded.firebase.identities["github.com"][0].
 */
function githubIdFromToken(decoded: DecodedIdToken): number | null {
  const identities = decoded.firebase?.identities as
    | Record<string, unknown>
    | undefined;
  const raw = identities?.["github.com"];
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const id = Number(raw[0]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function POST(req: Request): Promise<NextResponse> {
  const token = bearerToken(req);
  if (!token) {
    return errorResponse(
      401,
      "Missing Authorization: Bearer <firebase_id_token>",
    );
  }

  // 1. Verify the Firebase ID token.
  let decoded: DecodedIdToken;
  try {
    decoded = await adminAuth().verifyIdToken(token);
  } catch {
    return errorResponse(401, "Invalid or expired Firebase ID token");
  }

  const githubId = githubIdFromToken(decoded);
  if (githubId === null) {
    return errorResponse(401, "Token is not linked to a GitHub identity");
  }

  // 2. Parse the (optional, untrusted) display fields.
  let body: EatRequestBody = {};
  try {
    const parsed = (await req.json()) as unknown;
    if (parsed && typeof parsed === "object") {
      body = parsed as EatRequestBody;
    }
  } catch {
    // Empty/invalid body is fine for this endpoint — display fields are optional.
    body = {};
  }

  const identity: IngestIdentity = {
    githubId,
    login: asString(body.login) ?? `gh_${githubId}`,
    displayName: asString(body.displayName) ?? null,
    avatarUrl: asString(body.avatarUrl) ?? "",
  };

  // 3. Build a single server-authored eat event with a unique id.
  const nowMs = Date.now();
  const eat: IngestEatEvent = {
    kind: "eat",
    source: "web",
    eventId: `web:${randomUUID()}`,
    tsMs: nowMs,
    count: 1,
  };

  // 4. Apply.
  try {
    const { applied, duplicates, user } = await applyEvents(identity, [eat]);
    console.log(
      `[eat] uid=${user.uid} applied=${applied} duplicates=${duplicates}`,
    );
    return NextResponse.json(
      {
        ok: true,
        uid: user.uid,
        login: user.login,
        blackThunderCount: user.blackThunderCount,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[eat] apply failed", (err as Error).message);
    return errorResponse(500, "Failed to record eat event");
  }
}
