import type { Metadata } from "next";

import { LeaderboardTabs } from "@/app/components/LeaderboardTabs";

export const metadata: Metadata = {
  title: "AIザクザク度 ランキング ⚡ | Black Thunder",
  description:
    "AIザクザク度（AI利用で消費したブラックサンダーの本数）とブラックサンダーカウントを、個人・チームでリアルタイムに競うランキング。",
};

export default function LeaderboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="bt-stroke font-display text-2xl font-extrabold text-thunder-yellow sm:text-3xl">
          ⚡ ライブ ランキング
        </h1>
        <p className="text-sm text-white/60">
          AIザクザク度（消費した本数）とブラックサンダーカウント（食べた回数）を、リアルタイムで集計。
        </p>
      </header>

      <LeaderboardTabs topN={50} />
    </div>
  );
}
