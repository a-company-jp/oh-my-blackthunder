"use client";

// AIザクザク度 source breakdown: Claude vs Codex, from UserDoc.byProvider.
import { formatBars, relativeTimeJa } from "@/lib/format";
import { PROVIDERS, type Provider, type UserDoc } from "@/lib/shared/schema";

const PROVIDER_META: Record<Provider, { label: string; accent: string; emoji: string }> = {
  Claude: { label: "Claude", accent: "bg-thunder-yellow", emoji: "🟡" },
  Codex: { label: "Codex", accent: "bg-thunder-red", emoji: "🔴" },
};

export function ProviderBreakdown({ user }: { user: UserDoc }) {
  const total = PROVIDERS.reduce(
    (sum, p) => sum + (user.byProvider[p]?.bars ?? 0),
    0,
  );

  return (
    <section className="bt-panel p-5">
      <h2 className="mb-4 font-display text-lg font-extrabold text-thunder-yellow">
        AIザクザク内訳
      </h2>
      <ul className="flex flex-col gap-4">
        {PROVIDERS.map((provider) => {
          const stat = user.byProvider[provider];
          const bars = stat?.bars ?? 0;
          const pct = total > 0 ? Math.round((bars / total) * 100) : 0;
          const meta = PROVIDER_META[provider];
          return (
            <li key={provider} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display font-bold text-white">
                  <span aria-hidden className="mr-1">
                    {meta.emoji}
                  </span>
                  {meta.label}
                </span>
                <span className="tabular-nums text-sm text-white/70">
                  <span className="font-display font-extrabold text-thunder-yellow">
                    {formatBars(bars)}
                  </span>{" "}
                  本
                  <span className="ml-2 text-white/40">{pct}%</span>
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full border-2 border-thunder-black bg-thunder-black/60">
                <div
                  className={`h-full rounded-full ${meta.accent} transition-[width] duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-white/40">
                {stat
                  ? `${stat.events}イベント · 最終 ${relativeTimeJa(stat.lastEventAtMs)}`
                  : "まだ記録がありません"}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
