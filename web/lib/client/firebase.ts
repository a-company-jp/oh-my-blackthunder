"use client";

// ---------------------------------------------------------------------------
// HMR-safe client-side Firebase singletons.
//
// Next.js Fast Refresh re-evaluates modules, which would otherwise call
// initializeApp() repeatedly and throw. We reuse the already-initialized app
// (getApps()) and stash emulator-wiring guards on globalThis so we connect the
// emulators exactly once per browser session.
//
// The browser SDK is READ-ONLY against Firestore (firestore.rules deny client
// writes); all mutations go through firebase-admin Route Handlers. Auth here is
// session identity only — the GitHub numeric id (the real doc key) is derived
// from getAdditionalUserInfo() in lib/auth-context.tsx.
// ---------------------------------------------------------------------------

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GithubAuthProvider,
  connectAuthEmulator,
  getAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const USE_EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "1";

// One-time emulator-wiring guard that survives Fast Refresh.
const emulatorState = globalThis as typeof globalThis & {
  __btEmulatorAuth?: boolean;
  __btEmulatorFirestore?: boolean;
};

export const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

if (USE_EMULATOR) {
  if (!emulatorState.__btEmulatorAuth) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    emulatorState.__btEmulatorAuth = true;
  }
  if (!emulatorState.__btEmulatorFirestore) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    emulatorState.__btEmulatorFirestore = true;
  }
}

/** GitHub provider with the `read:user` scope so we can resolve the numeric id. */
export function githubProvider(): GithubAuthProvider {
  const provider = new GithubAuthProvider();
  provider.addScope("read:user");
  return provider;
}
