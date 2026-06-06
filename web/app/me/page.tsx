"use client";

// /me — redirect helper to the signed-in user's own profile.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { SignInButton } from "@/app/components/SignInButton";
import { Loading } from "@/app/components/StateViews";
import { MascotEmpty } from "@/app/components/MascotEmpty";
import { useAuth } from "@/lib/auth-context";

export default function MePage() {
  const router = useRouter();
  const { user, login, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && login) {
      router.replace(`/u/${login}`);
    }
  }, [loading, user, login, router]);

  if (loading) {
    return <Loading label="読み込み中…" />;
  }

  if (!user) {
    return (
      <MascotEmpty
        mascot="niko"
        title="サインインしてマイページへ"
        subtitle="GitHubでサインインすると、あなたのAIザクザク度を確認できます。"
      >
        <div className="mt-2">
          <SignInButton />
        </div>
      </MascotEmpty>
    );
  }

  // Signed in but the GitHub login isn't resolved yet (e.g. session restored on
  // reload before re-auth). Prompt a re-sign-in to recover it.
  if (!login) {
    return (
      <MascotEmpty
        mascot="ike"
        title="もう一度サインインしてください"
        subtitle="マイページを開くにはGitHubアカウント情報の再取得が必要です。"
      >
        <div className="mt-2">
          <SignInButton />
        </div>
      </MascotEmpty>
    );
  }

  return <Loading label="マイページへ移動中…" />;
}
