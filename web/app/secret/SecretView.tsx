"use client";

// ---------------------------------------------------------------------------
// The hidden /secret mini-moment. Tap the monster to crunch it (CrunchBurst +
// jingle); a tiny counter eggs you on. Pure client fun — no data, no tracking.
// Reuses CrunchBurst (reduced-motion safe) and the gesture-only crunch sound.
// ---------------------------------------------------------------------------

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";

import { CrunchBurst } from "@/app/components/CrunchBurst";
import { playCrunch } from "@/app/components/eastereggs/crunchSound";

const MILESTONES: Record<number, string> = {
  1: "いいザクザク！",
  5: "止まらないザクザク！",
  10: "ザクザクマスター⚡",
  25: "伝説のザクザクエンジニア🍫",
};

export function SecretView() {
  const [count, setCount] = useState(0);
  const [burst, setBurst] = useState(0);

  const onCrunch = useCallback(() => {
    setCount((c) => c + 1);
    setBurst((n) => n + 1);
    playCrunch();
  }, []);

  const milestone = MILESTONES[count];

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-16 text-center">
      <p className="bt-chip border-thunder-yellow text-thunder-yellow">
        ⚡ ひみつのザクザク部屋 ⚡
      </p>
      <h1 className="bt-stroke-lg font-display text-3xl font-extrabold text-thunder-yellow sm:text-4xl">
        よくぞ見つけた！
      </h1>
      <p className="max-w-md text-sm text-white/60">
        ここは隠しページ。モンスターをタップして、ひたすらザクザクしよう。
      </p>

      <button
        type="button"
        onClick={onCrunch}
        aria-label="ザクザクする"
        className="relative grid place-items-center rounded-full p-4 transition active:scale-95"
      >
        <CrunchBurst trigger={burst} label="ザクザク!⚡" />
        <Image
          src="/assets/monster/wi.png"
          alt=""
          width={180}
          height={180}
          aria-hidden
          className="h-36 w-auto select-none drop-shadow-[0_8px_0_rgba(0,0,0,0.6)]"
          priority
        />
      </button>

      <p className="font-display text-2xl font-extrabold text-white">
        <span className="text-thunder-yellow">{count}</span> ザクザク
      </p>
      {milestone ? (
        <p className="animate-crunchPop font-display text-lg font-extrabold text-thunder-red">
          {milestone}
        </p>
      ) : null}

      <Link href="/" className="bt-button mt-2">
        ホームへ戻る
      </Link>
    </div>
  );
}
