import type { Metadata } from "next";

import { TeamsPageClient } from "@/app/teams/TeamsPageClient";

export const metadata: Metadata = {
  title: "チーム ⚡ | Black Thunder",
  description:
    "仲間とチームを組んで、合計のAIザクザク度を競おう。チームランキングをリアルタイムで集計。",
};

export default function TeamsPage() {
  return <TeamsPageClient />;
}
