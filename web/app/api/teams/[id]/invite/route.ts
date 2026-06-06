// ============================================================================
// POST /api/teams/[id]/invite — invite a GitHub login to a team (SERVER, nodejs).
//
// Auth: Authorization: Bearer <firebase_id_token>. The caller must be a member of
// the team. Creates a pending invite at teams/{id}/invites/{loginLower}.
// ============================================================================

import { NextResponse } from "next/server";

import { FirebaseAuthError, verifyFirebaseUser } from "@/lib/server/auth";
import { inviteToTeam, TeamError, type TeamActor } from "@/lib/server/teams";

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

  let body: { login?: unknown };
  try {
    body = (await req.json()) as { login?: unknown };
  } catch {
    return errorResponse(400, "Body must be valid JSON");
  }

  try {
    const result = await inviteToTeam(actor, id, body.login);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof TeamError) return errorResponse(err.status, err.message);
    console.error("[teams] invite failed", (err as Error).message);
    return errorResponse(500, "Failed to create invite");
  }
}
