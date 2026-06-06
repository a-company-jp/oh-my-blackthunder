// ============================================================================
// Firebase ID-token verification (SERVER-ONLY).
//
// Browser-authed API routes (eat, teams, tokens, me, connect/mint) take an
// Authorization: Bearer <FirebaseIdToken>. We verify the token via the admin SDK,
// then extract the GitHub NUMERIC id from the federated identity claims
// (decoded.firebase.identities["github.com"][0]) — the SAME stable join key the
// client-app ingest path converges on (uid = gh_<githubId>).
//
// The Firebase Auth uid is session-only and is never used as a Firestore doc key.
// ============================================================================

import type { DecodedIdToken } from "firebase-admin/auth";

import { adminAuth } from "@/lib/server/firebase-admin";
import { uidForGithubId } from "@/lib/shared/schema";

/** Identity resolved from a verified Firebase ID token. */
export interface FirebaseUser {
  /** Firestore doc key: gh_<githubId>. */
  uid: string;
  /** Stable GitHub numeric id (immutable across login renames). */
  githubId: number;
  /** Best-effort current GitHub login from the token, if present. */
  login?: string;
  /** Best-effort display name from the token, if present. */
  displayName?: string;
  /** Best-effort avatar URL from the token, if present. */
  avatarUrl?: string;
}

/**
 * Typed error for Firebase auth failures. `status` carries the HTTP status the
 * route should surface (401 for a missing/invalid token or a token not linked to
 * a GitHub identity).
 */
export class FirebaseAuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "FirebaseAuthError";
    this.status = status;
  }
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

/**
 * Verify a Firebase bearer ID token and resolve the caller's identity.
 *
 * @throws {FirebaseAuthError} 401 if the token is missing/invalid or is not
 *         linked to a GitHub identity.
 */
export async function verifyFirebaseUser(
  bearer: string | null | undefined,
): Promise<FirebaseUser> {
  const token = (bearer ?? "").trim();
  if (token.length === 0) {
    throw new FirebaseAuthError(
      "Missing Authorization: Bearer <firebase_id_token>",
    );
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await adminAuth().verifyIdToken(token);
  } catch {
    throw new FirebaseAuthError("Invalid or expired Firebase ID token");
  }

  const githubId = githubIdFromToken(decoded);
  if (githubId === null) {
    throw new FirebaseAuthError("Token is not linked to a GitHub identity");
  }

  // Display fields are best-effort; the GitHub provider populates them on the
  // standard OIDC claims. They are NEVER trusted for scoring — only for display.
  // NOTE: the Firebase ID token does not reliably carry the GitHub *login*
  // (username). Callers that need the login (team invites) should prefer the
  // login already stored on the user doc (set by ingest/eat) and treat this as a
  // fallback only. `screen_name` is present on some GitHub-provider tokens.
  const claims = decoded as unknown as Record<string, unknown>;
  const login = asString(claims.screen_name) ?? asString(claims.name);

  return {
    uid: uidForGithubId(githubId),
    githubId,
    login,
    displayName: asString(decoded.name),
    avatarUrl: asString(decoded.picture),
  };
}
