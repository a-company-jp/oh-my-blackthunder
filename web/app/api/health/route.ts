// ============================================================================
// GET /api/health — dependency-free liveness probe (SERVER, nodejs).
// Used by Cloud Run / load balancers; must not touch Firestore or any I/O.
// ============================================================================

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json({ ok: true }, { status: 200 });
}
