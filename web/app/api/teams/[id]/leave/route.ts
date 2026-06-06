// ============================================================================
// POST /api/teams/[id]/leave — leave a team (SERVER, nodejs).
//
// Auth: Authorization: Bearer <firebase_id_token>. Removes the caller; the team
// totals are decremented by the caller's contribution and the member doc is
// deleted. Owner policy: ownership transfers to the earliest-joined remaining
// member; an owner who is the only member is blocked (must delete the team).
// ============================================================================

import { NextResponse } from "next/server";

import { FirebaseAuthError, verifyFirebaseUser } from "@/lib/server/auth";
import { leaveTeam, TeamError, type TeamActor } from "@/lib/server/teams";

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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;

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

  try {
    const result = await leaveTeam(actor, id);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof TeamError) return errorResponse(err.status, err.message);
    console.error("[teams] leave failed", (err as Error).message);
    return errorResponse(500, "Failed to leave team");
  }
}
