import type { Metadata } from "next";

import { ProfileView } from "@/app/u/[id]/ProfileView";
import { uidForGithubId } from "@/lib/shared/schema";

// Next 15: route params are async。URL は安定な GitHub 数値 id を使う（login は
// リネームされ得るため）。例: /u/12345 。uid = gh_<id> に正規化して解決する。
type Params = Promise<{ id: string }>;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `AIザクザク度 ⚡ | ブラッカソン`,
    description: `AIザクザク度とブラックサンダーカウント。`,
  };
}

export default async function ProfilePage({ params }: { params: Params }) {
  const { id } = await params;
  // "12345" でも "gh_12345" でも受けられるよう数字だけ取り出して正規化。
  const githubId = Number(decodeURIComponent(id).replace(/^gh_/, ""));
  const uid = Number.isFinite(githubId) && githubId > 0 ? uidForGithubId(githubId) : "";
  return <ProfileView uid={uid} />;
}
