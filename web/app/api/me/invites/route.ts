// ============================================================================
// GET /api/me/invites — list pending team invites for the caller (SERVER, nodejs).
//
// Auth: Authorization: Bearer <firebase_id_token>. Returns the pending invites
// addressed to the caller's GitHub login across all teams.
// ============================================================================

import { NextResponse } from "next/server";

import { FirebaseAuthError, verifyFirebaseUser } from "@/lib/server/auth";
import { listMyInvites, TeamError, type TeamActor } from "@/lib/server/teams";

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

export async function GET(req: Request): Promise<NextResponse> {
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
    const { invites } = await listMyInvites(actor);
    return NextResponse.json({ invites }, { status: 200 });
  } catch (err) {
    if (err instanceof TeamError) return errorResponse(err.status, err.message);
    console.error("[me/invites] list failed", (err as Error).message);
    return errorResponse(500, "Failed to list invites");
  }
}
