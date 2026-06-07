"use client";

// Profile activity panel: a daily sparkline of recent AIザクザク度 (most recent
// on the right) plus a per-day list. Subscribes to users/{uid}/daily.
import { useEffect, useMemo, useState } from "react";

import { Sparkline } from "@/app/components/Sparkline";
import { Empty, ErrorView } from "@/app/components/StateViews";
import { formatBars } from "@/lib/format";
import { subscribeActivity } from "@/lib/client/firestore";
import type { DailyDoc } from "@/lib/shared/schema";

interface ProfileActivityProps {
  uid: string;
  days?: number;
}

/** yyyymmdd (JST) -> "M/D (曜)"。
 *  day はカレンダー日付の数字そのもの。UTC で組み立てて曜日を読むのは
 *  タイムゾーン変換ではなく曜日算出のためで、JST キーでも正しい。 */
function formatDay(day: string): string {
  if (day.length !== 8) return day;
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(4, 6));
  const d = Number(day.slice(6, 8));
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getUTCDay()];
  return `${m}/${d} (${weekday})`;
}

export function ProfileActivity({ uid, days = 30 }: ProfileActivityProps) {
  const [daily, setDaily] = useState<DailyDoc[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setError(null);
    setDaily(null);
    const unsub = subscribeActivity(
      uid,
      days,
      (next) => setDaily(next),
      (e) => setError(e),
    );
    return unsub;
  }, [uid, days]);

  // subscribeActivity returns newest-first; the sparkline wants oldest-first.
  const chrono = useMemo(
    () => (daily ? [...daily].reverse() : []),
    [daily],
  );
  const sparkValues = useMemo(() => chrono.map((d) => d.bars), [chrono]);

  const maxBars =
    daily && daily.length ? Math.max(...daily.map((d) => d.bars), 0.001) : 0.001;

  const totalRecent = useMemo(
    () => (daily ? daily.reduce((s, d) => s + d.bars, 0) : 0),
    [daily],
  );

  return (
    <section className="bt-panel p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold text-thunder-yellow">
          📈 ザクザク履歴
        </h2>
        {daily && daily.length ? (
          <span className="text-xs text-white/45">
            直近{daily.length}日: 合計{" "}
            <span className="font-bold text-thunder-yellow">
              {formatBars(totalRecent)}
            </span>{" "}
            本
          </span>
        ) : null}
      </div>

      {error ? (
        <ErrorView title="履歴を読み込めませんでした" message={error.message} />
      ) : daily === null ? (
        <div className="h-14 animate-pulse rounded-xl bg-thunder-black/40" />
      ) : daily.length === 0 ? (
        <Empty
          mascot="gusu"
          title="まだ履歴がありません"
          subtitle="AIを使い始めると、日ごとのザクザクがここに並びます。"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Sparkline */}
          <div className="rounded-xl border-2 border-thunder-black bg-thunder-black/40 p-3">
            <Sparkline values={sparkValues} />
          </div>

          {/* Per-day list */}
          <ul className="flex flex-col gap-2">
            {daily.map((d) => {
              const pct = Math.min(100, Math.round((d.bars / maxBars) * 100));
              return (
                <li
                  key={d.day}
                  className="flex items-center gap-3 rounded-xl border-2 border-thunder-black bg-thunder-black/40 px-3 py-2"
                >
                  <span className="w-20 shrink-0 text-sm font-bold text-white/70">
                    {formatDay(d.day)}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-thunder-black/70">
                    <div
                      className="h-full rounded-full bg-thunder-yellow transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right tabular-nums text-sm">
                    <span className="font-display font-extrabold text-thunder-yellow">
                      {formatBars(d.bars)}
                    </span>
                    <span className="text-white/50"> 本</span>
                  </span>
                  {d.eats > 0 ? (
                    <span className="bt-chip border-choco-light/60 bg-choco/40 text-xs text-white/80">
                      🍫 {d.eats}
                    </span>
                  ) : (
                    <span className="w-10 shrink-0" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
