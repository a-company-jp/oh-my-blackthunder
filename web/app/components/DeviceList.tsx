"use client";

// The user's RunThunder devices (subscribe users/{uid}/devices). Each device
// shows its share of the user's total bars as a rounded usage bar, matching the
// RunThunder dashboard look.
import { useEffect, useState } from "react";

import { UsageBar } from "@/app/components/UsageBar";
import { formatBars, relativeTimeJa } from "@/lib/format";
import { subscribeDevices } from "@/lib/client/firestore";
import type { DeviceDoc } from "@/lib/shared/schema";

function platformEmoji(platform: string): string {
  const p = platform.toLowerCase();
  if (p.includes("mac") || p.includes("darwin")) return "🍎";
  if (p.includes("win")) return "🪟";
  if (p.includes("linux")) return "🐧";
  return "💻";
}

export function DeviceList({ uid }: { uid: string }) {
  const [devices, setDevices] = useState<DeviceDoc[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setError(null);
    setDevices(null);
    const unsub = subscribeDevices(
      uid,
      (next) => setDevices(next),
      (e) => setError(e),
    );
    return unsub;
  }, [uid]);

  const total =
    devices && devices.length
      ? Math.max(
          devices.reduce((s, d) => s + d.bars, 0),
          0.0001,
        )
      : 0.0001;

  return (
    <section className="bt-panel p-5">
      <h2 className="mb-4 font-display text-lg font-extrabold text-thunder-yellow">
        🖥️ デバイス
      </h2>

      {error ? (
        <p className="text-sm text-white/50">デバイスを読み込めませんでした。</p>
      ) : devices === null ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-xl bg-thunder-black/40"
            />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <p className="text-sm text-white/50">
          まだ RunThunder のデバイスが連携されていません。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {devices.map((d) => (
            <li key={d.deviceId} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 font-bold text-white">
                  <span aria-hidden>{platformEmoji(d.platform)}</span>
                  <span className="truncate">{d.name || d.deviceId}</span>
                </span>
                <span className="shrink-0 tabular-nums text-sm">
                  <span className="font-display font-extrabold text-thunder-yellow">
                    {formatBars(d.bars)}
                  </span>
                  <span className="text-white/50"> 本</span>
                </span>
              </div>
              <UsageBar fraction={d.bars / total} />
              <p className="text-xs text-white/40">
                最終: {relativeTimeJa(d.lastSeenAtMs)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
