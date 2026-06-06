// ============================================================================
// firebase-admin lazy singleton (SERVER-ONLY).
//
// All writes to Firestore go through this admin SDK in Route Handlers; clients
// are read-only (firestore.rules deny client writes). Never import this from a
// browser/client component.
//
// Credentials:
//   - Production (Cloud Run): Application Default Credentials via the attached
//     runtime service account. No JSON key in the image. GOOGLE_CLOUD_PROJECT is
//     set automatically by Cloud Run.
//   - Local emulator: when FIRESTORE_EMULATOR_HOST is set, the Admin SDK talks to
//     the Firestore emulator and needs only a projectId (no real credentials).
//
// Route Handlers that import this MUST `export const runtime = "nodejs";`
// ============================================================================

import {
  applicationDefault,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const APP_NAME = "zakuzaku-admin";

/** Resolve the GCP/Firebase project id from the environment. */
function resolveProjectId(): string | undefined {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    undefined
  );
}

/** Are we pointed at the local Firestore emulator? */
function usingEmulator(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

/**
 * Lazily initialize (or reuse) the named admin app. The `getApps()` guard makes
 * this safe across Next.js hot-reload / multiple route invocations in one
 * process.
 */
export function getAdminApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  const projectId = resolveProjectId();

  if (usingEmulator()) {
    // Emulator: projectId only — no credentials. The Admin SDK reads
    // FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST automatically.
    return initializeApp({ projectId }, APP_NAME);
  }

  return initializeApp(
    {
      credential: applicationDefault(),
      projectId,
    },
    APP_NAME,
  );
}

let firestoreSingleton: Firestore | null = null;

/** The admin Firestore instance (singleton). */
export function adminDb(): Firestore {
  if (firestoreSingleton) return firestoreSingleton;
  const app = getAdminApp();
  firestoreSingleton = getFirestore(app);
  return firestoreSingleton;
}

/** The admin Auth instance (used to verify Firebase ID tokens on the web path). */
export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

// Re-export a typed handle to the already-initialized app for callers that want
// it without re-running the guard (e.g. tests).
export function existingAdminApp(): App | null {
  return getApps().some((a) => a.name === APP_NAME) ? getApp(APP_NAME) : null;
}
