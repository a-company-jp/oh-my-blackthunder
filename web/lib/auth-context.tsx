"use client";

// ---------------------------------------------------------------------------
// GitHub-only auth context.
//
// The Firebase Auth uid is session identity only. The REAL doc key is the
// GitHub NUMERIC id, which is only available from getAdditionalUserInfo() at
// sign-in time. We capture it then and keep it in state (and sessionStorage so
// it survives reloads while the Firebase session persists).
// ---------------------------------------------------------------------------

import {
  GithubAuthProvider,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { auth, githubProvider } from "@/lib/client/firebase";

const GITHUB_ID_KEY = "bt:githubId";
const GITHUB_LOGIN_KEY = "bt:githubLogin";

export interface AuthState {
  user: User | null;
  githubId: number | null;
  login: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

function readSession<T>(key: string, coerce: (raw: string) => T): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(key);
  if (raw == null) return null;
  try {
    return coerce(raw);
  } catch {
    return null;
  }
}

function friendlyError(e: unknown): string {
  const code =
    typeof e === "object" && e !== null && "code" in e
      ? String((e as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/popup-blocked":
      return "ポップアップがブロックされました。ブラウザの設定で許可してから、もう一度お試しください。";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "サインインがキャンセルされました。";
    case "auth/account-exists-with-different-credential":
      return "このメールアドレスは別のログイン方法で登録されています。GitHub以外の方法でお試しください。";
    case "auth/network-request-failed":
      return "ネットワークエラーが発生しました。接続を確認してください。";
    default:
      return "サインインに失敗しました。もう一度お試しください。";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [githubId, setGithubId] = useState<number | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Restore the GitHub identity captured at sign-in.
    setGithubId(readSession(GITHUB_ID_KEY, (raw) => Number(raw)));
    setLogin(readSession(GITHUB_LOGIN_KEY, (raw) => raw));

    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
      if (!next) {
        setGithubId(null);
        setLogin(null);
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(GITHUB_ID_KEY);
          window.sessionStorage.removeItem(GITHUB_LOGIN_KEY);
        }
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      const cred = await signInWithPopup(auth, githubProvider());
      const info = getAdditionalUserInfo(cred);
      const profile = info?.profile as
        | { id?: number | string; login?: string }
        | undefined;

      const id = profile?.id != null ? Number(profile.id) : null;
      const ghLogin = profile?.login ?? info?.username ?? null;

      if (id != null && Number.isFinite(id)) {
        setGithubId(id);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(GITHUB_ID_KEY, String(id));
        }
      }
      if (ghLogin) {
        setLogin(ghLogin);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(GITHUB_LOGIN_KEY, ghLogin);
        }
      }
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await fbSignOut(auth);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  const getIdToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      githubId,
      login,
      avatarUrl: user?.photoURL ?? null,
      displayName: user?.displayName ?? null,
      loading,
      error,
      signIn,
      signOut,
      getIdToken,
    }),
    [user, githubId, login, loading, error, signIn, signOut, getIdToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}

// Re-exported for callers that need to detect GitHub credentials elsewhere.
export { GithubAuthProvider };
