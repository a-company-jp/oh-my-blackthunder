// ============================================================================
// POST /api/teams/join — join a team by its invite code (SERVER, nodejs).
//
// Auth: Authorization: Bearer <firebase_id_token>. The joiner's current totals
// are folded into the team aggregate and a member snapshot is written.
// ============================================================================

import { NextResponse } from "next/server";

import { FirebaseAuthError, verifyFirebaseUser } from "@/lib/server/auth";
import { joinTeamByCode, TeamError, type TeamActor } from "@/lib/server/teams";

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
  let actor: TeamActor;
  try {
    const user = await verifyFirebaseUser(bearerToken(req));
    actor = {
      uid: user.uid,
      githubId: user.githubId,
      login: user.login,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  } catch (err) {
    if (err instanceof FirebaseAuthError) return errorResponse(err.status, err.message);
    return errorResponse(500, "Authentication failed");
  }

  let body: { code?: unknown };
  try {
    body = (await req.json()) as { code?: unknown };
  } catch {
    return errorResponse(400, "Body must be valid JSON");
  }

  try {
    const { team } = await joinTeamByCode(actor, body.code);
    return NextResponse.json({ team }, { status: 200 });
  } catch (err) {
    if (err instanceof TeamError) return errorResponse(err.status, err.message);
    console.error("[teams] join failed", (err as Error).message);
    return errorResponse(500, "Failed to join team");
  }
}
