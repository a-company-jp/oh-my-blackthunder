// ============================================================================
// Website-brokered client auth tokens (SERVER-ONLY).
//
// Client apps (RunThunder / Chrome / …) never implement full GitHub OAuth. They
// open the website /connect flow; the site authenticates the user via Firebase
// (GitHub provider) and mints an OPAQUE app token (32 random bytes, hex). The raw
// token is shown to the client exactly ONCE and is never stored — only its
// sha256 hash is persisted as the doc id of apiTokens/{sha256(token)} ->
// ApiTokenDoc. /api/ingest verifies a bearer by hashing it and looking up that
// doc: no GitHub round-trip, fully revocable.
// ============================================================================

import { createHash, randomBytes } from "node:crypto";

import { adminDb } from "@/lib/server/firebase-admin";
import {
  COLLECTIONS,
  type ApiTokenDoc,
  type ClientApp,
} from "@/lib/shared/schema";

/** Identity fields stored alongside a minted token for display/audit. */
export interface TokenIdentity {
  githubId: number;
  login: string;
}

/** Resolved identity from a verified app token (used by /api/ingest). */
export interface AppTokenIdentity {
  uid: string;
  githubId: number;
  login: string;
}

/** Public (raw-token-free) view of a stored token, for the management UI. */
export interface TokenSummary {
  tokenId: string; // sha256(token) == doc id; safe to expose (used for revoke)
  app: ClientApp;
  label: string | null;
  createdAtMs: number;
  lastUsedAtMs: number | null;
  revoked: boolean;
}

/**
 * Typed error for app-token verification failures. `status` is the HTTP status
 * the ingest route should surface (401 for missing/invalid/revoked).
 */
export class AppTokenError extends Error {
  readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AppTokenError";
    this.status = status;
  }
}

const VALID_APPS: ReadonlySet<ClientApp> = new Set<ClientApp>([
  "runthunder",
  "chrome",
  "vscode",
  "jetbrains",
  "zsh",
  "other",
]);

export function isClientApp(value: unknown): value is ClientApp {
  return typeof value === "string" && VALID_APPS.has(value as ClientApp);
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Mint a fresh opaque app token for the given user and store its hash. Returns
 * the RAW token (shown once); the caller must never persist it.
 */
export async function mintToken(
  uid: string,
  identity: TokenIdentity,
  app: ClientApp,
  label?: string | null,
): Promise<{ token: string; app: ClientApp; label: string | null }> {
  if (!isClientApp(app)) {
    throw new AppTokenError(`Unknown client app: ${String(app)}`, 400);
  }
  const token = randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  const nowMs = Date.now();
  const normalizedLabel =
    typeof label === "string" && label.trim().length > 0
      ? label.trim().slice(0, 120)
      : null;

  const doc: ApiTokenDoc = {
    tokenHash,
    uid,
    githubId: identity.githubId,
    login: identity.login,
    app,
    label: normalizedLabel,
    createdAtMs: nowMs,
    lastUsedAtMs: null,
    revoked: false,
  };

  await adminDb()
    .collection(COLLECTIONS.apiTokens)
    .doc(tokenHash)
    .set(doc);

  return { token, app, label: normalizedLabel };
}

/**
 * Verify a bearer app token: hash it, load apiTokens/{hash}, reject if missing
 * or revoked. Best-effort, non-blocking update of lastUsedAtMs. Returns the
 * resolved identity (no GitHub round-trip).
 *
 * @throws {AppTokenError} 401 if the token is missing/invalid/revoked.
 */
export async function verifyAppToken(
  bearer: string | null | undefined,
): Promise<AppTokenIdentity> {
  const token = (bearer ?? "").trim();
  if (token.length === 0) {
    throw new AppTokenError("Missing Authorization: Bearer <app_token>");
  }

  const tokenHash = sha256Hex(token);
  const ref = adminDb().collection(COLLECTIONS.apiTokens).doc(tokenHash);

  let snap: FirebaseFirestore.DocumentSnapshot;
  try {
    snap = await ref.get();
  } catch (err) {
    throw new AppTokenError(
      `Failed to verify token: ${(err as Error).message}`,
      500,
    );
  }
  if (!snap.exists) {
    throw new AppTokenError("Invalid app token");
  }
  const data = snap.data() as ApiTokenDoc;
  if (data.revoked) {
    throw new AppTokenError("Revoked app token");
  }

  // Best-effort, non-blocking last-used touch. Never block ingest on this and
  // never let a failure here surface as an auth error.
  ref
    .update({ lastUsedAtMs: Date.now() })
    .catch((err: unknown) =>
      console.warn(
        "[tokens] lastUsedAtMs update failed",
        (err as Error)?.message,
      ),
    );

  return { uid: data.uid, githubId: data.githubId, login: data.login };
}

/** List a user's tokens (never includes the raw token). */
export async function listTokens(uid: string): Promise<TokenSummary[]> {
  const snap = await adminDb()
    .collection(COLLECTIONS.apiTokens)
    .where("uid", "==", uid)
    .get();

  const tokens: TokenSummary[] = snap.docs.map((d) => {
    const data = d.data() as ApiTokenDoc;
    return {
      tokenId: d.id,
      app: data.app,
      label: data.label,
      createdAtMs: data.createdAtMs,
      lastUsedAtMs: data.lastUsedAtMs,
      revoked: data.revoked,
    };
  });
  tokens.sort((a, b) => b.createdAtMs - a.createdAtMs);
  return tokens;
}

/**
 * Revoke a token by its doc id (sha256). Only the owning user may revoke; a
 * mismatched owner is treated as not-found to avoid leaking existence.
 *
 * @returns true if a token was revoked; false if no matching token exists.
 */
export async function revokeToken(
  uid: string,
  tokenId: string,
): Promise<boolean> {
  if (typeof tokenId !== "string" || tokenId.trim().length === 0) {
    throw new AppTokenError("tokenId is required", 400);
  }
  const ref = adminDb()
    .collection(COLLECTIONS.apiTokens)
    .doc(tokenId.trim());

  const snap = await ref.get();
  if (!snap.exists) return false;
  const data = snap.data() as ApiTokenDoc;
  if (data.uid !== uid) return false;
  if (data.revoked) return true;
  await ref.update({ revoked: true });
  return true;
}
