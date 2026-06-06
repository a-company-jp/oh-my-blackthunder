// ============================================================================
// POST /api/teams — create a team (SERVER, nodejs).
//
// Auth: Authorization: Bearer <firebase_id_token>. The creator becomes the owner
// member; the team totals are seeded from the creator's current totals and the
// team id is added to user.teamIds.
// ============================================================================

import { NextResponse } from "next/server";

import { FirebaseAuthError, verifyFirebaseUser } from "@/lib/server/auth";
import { createTeam, TeamError, type TeamActor } from "@/lib/server/teams";

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

  let body: { name?: unknown; emoji?: unknown; description?: unknown };
  try {
    body = (await req.json()) as {
      name?: unknown;
      emoji?: unknown;
      description?: unknown;
    };
  } catch {
    return errorResponse(400, "Body must be valid JSON");
  }

  try {
    const { team } = await createTeam(actor, {
      name: body.name,
      emoji: body.emoji,
      description: body.description,
    });
    return NextResponse.json({ team }, { status: 201 });
  } catch (err) {
    if (err instanceof TeamError) return errorResponse(err.status, err.message);
    console.error("[teams] create failed", (err as Error).message);
    return errorResponse(500, "Failed to create team");
  }
}
