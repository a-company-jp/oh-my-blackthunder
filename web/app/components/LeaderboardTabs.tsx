"use client";

// Individual-vs-team ranking switcher. Both tabs are live; the URL hash keeps
// the active tab shareable / reload-stable (#teams).
import { useEffect, useState } from "react";
import clsx from "clsx";

import { Leaderboard } from "@/app/components/Leaderboard";
import { TeamLeaderboard } from "@/app/components/TeamLeaderboard";

type Tab = "individual" | "team";

export function LeaderboardTabs({ topN = 50 }: { topN?: number }) {
  const [tab, setTab] = useState<Tab>("individual");

  // Sync from the URL hash on mount so #teams deep-links land on the team tab.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#teams") setTab("team");
  }, []);

  function select(next: Tab) {
    setTab(next);
    if (typeof window !== "undefined") {
      const hash = next === "team" ? "#teams" : "#individual";
      history.replaceState(null, "", hash);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="ランキングの種類"
          className="inline-flex gap-1 rounded-full border-2 border-thunder-black bg-thunder-ink/80 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "individual"}
            onClick={() => select("individual")}
            className={clsx(
              "bt-tab",
              tab === "individual" ? "bt-tab-active" : "bt-tab-idle",
            )}
          >
            👤 個人
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "team"}
            onClick={() => select("team")}
            className={clsx(
              "bt-tab",
              tab === "team" ? "bt-tab-active" : "bt-tab-idle",
            )}
          >
            🤝 チーム
          </button>
        </div>

        <span className="bt-chip border-thunder-yellow/60 bg-thunder-yellow/10 text-thunder-yellow">
          <span className="h-2 w-2 animate-ping rounded-full bg-thunder-yellow" />
          LIVE
        </span>
      </div>

      <div role="tabpanel">
        {tab === "individual" ? (
          <Leaderboard topN={topN} />
        ) : (
          <TeamLeaderboard topN={topN} />
        )}
      </div>
    </div>
  );
}
