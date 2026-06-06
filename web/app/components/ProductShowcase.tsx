"use client";

// ---------------------------------------------------------------------------
// Product showcase grid for the landing page. Each card is a playful Black
// Thunder panel with a sticker/monster, a JA tagline + description, and a
// GitHub link. Cards lift on hover and the artwork wiggles.
// ---------------------------------------------------------------------------

import Image from "next/image";

import { useTilt } from "@/app/components/eastereggs/useTilt";

interface Product {
  name: string;
  tagline: string;
  description: string;
  href: string;
  art: string;
  accent: string; // tailwind text color for the tagline
  rotate: string; // resting tilt for the artwork
}

const PRODUCTS: Product[] = [
  {
    name: "oh-my-blackthunder",
    tagline: "zsh フレームワーク",
    description:
      "ターミナルにブラックサンダーを。AIのザクザク開発を計測し、シェルから「食べた！」を宣言できる zsh プラグイン集。",
    href: "https://github.com/a-company-jp/oh-my-blackthunder",
    art: "/assets/sticker/zakuzaku-hack.png",
    accent: "text-thunder-yellow",
    rotate: "-rotate-6",
  },
  {
    name: "oh-my-blackthunder for JetBrains",
    tagline: "JetBrains プラグイン",
    description:
      "IntelliJ / PyCharm などの JetBrains IDE から、AIザクザク度をそのまま記録。コーディングのお供にブラックサンダーを。",
    href: "https://github.com/a-company-jp/oh-my-blackthunder-jetbrains",
    art: "/assets/sticker/fullsnack-engineer.png",
    accent: "text-thunder-red",
    rotate: "rotate-3",
  },
  {
    name: "blackthunder-chrome",
    tagline: "ThunderCaptcha 拡張",
    description:
      "「私はブラックサンダーを食べました」にチェック。reCAPTCHA 風のチェックボックスで、食べた回数をザクザク記録する Chrome 拡張。",
    href: "https://github.com/a-company-jp/blackthunder-chrome",
    art: "/assets/sticker/iam-blackthunder.png",
    accent: "text-thunder-yellow",
    rotate: "-rotate-3",
  },
  {
    name: "blackthunder-vscode",
    tagline: "VS Code 拡張",
    description:
      "エディタを離れずにAIザクザク度を可視化。ステータスバーでブラックサンダーの本数を眺めながら、BTDD で開発を進めよう。",
    href: "https://github.com/a-company-jp/blackthunder-vscode",
    art: "/assets/sticker/lgtm.png",
    accent: "text-thunder-red",
    rotate: "rotate-6",
  },
  {
    name: "RunThunder",
    tagline: "macOS メニューバー アプリ",
    description:
      "デバイスごとのAIザクザク度を計測してランキングへ送信。スパークラインと使用率バーで、あなたのザクザクを毎日チェック。",
    href: "https://github.com/a-company-jp/RunThunder",
    art: "/assets/monster/ike.png",
    accent: "text-thunder-yellow",
    rotate: "rotate-2",
  },
  {
    name: "blackthunder-battery",
    tagline: "おまけ ガジェット",
    description:
      "ブラックサンダーは電池になるのか? エネルギーあふれる実験プロジェクト。ザクザクの精神でなんでも作る。",
    href: "https://github.com/a-company-jp/blackthunder-battery",
    art: "/assets/sticker/battery.png",
    accent: "text-thunder-red",
    rotate: "-rotate-2",
  },
];

// Environment / tech logos per product (brand marks in public/assets/tech).
const TECH_LOGOS: Record<string, string[]> = {
  "oh-my-blackthunder": ["apple"],
  "oh-my-blackthunder for JetBrains": ["jetbrains", "intellij", "pycharm", "webstorm"],
  "blackthunder-chrome": ["chrome"],
  "blackthunder-vscode": ["vscode"],
  RunThunder: ["apple"],
  "blackthunder-battery": [],
};

function TechLogos({ name }: { name: string }) {
  const logos = TECH_LOGOS[name] ?? [];
  if (logos.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5" aria-label="対応環境">
      {logos.map((logo) => (
        <span
          key={logo}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/5 p-1 ring-1 ring-white/10 transition group-hover:ring-thunder-yellow/40"
        >
          <Image
            src={`/assets/tech/${logo}.svg`}
            alt=""
            width={18}
            height={18}
            unoptimized
            aria-hidden
            className="h-4 w-4 object-contain"
          />
        </span>
      ))}
    </div>
  );
}

function GithubMark() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className="shrink-0"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function ProductCard({ p }: { p: Product }) {
  // Cursor-follow tilt (no-op under reduced-motion / touch).
  const tiltRef = useTilt<HTMLAnchorElement>();
  return (
    <a
      ref={tiltRef}
      href={p.href}
      target="_blank"
      rel="noopener noreferrer"
      className="bt-panel group relative flex flex-col gap-3 overflow-hidden p-5 transition-transform duration-200 [transform-style:preserve-3d] will-change-transform"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-thunder-yellow/10 blur-2xl transition group-hover:bg-thunder-yellow/20"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`font-display text-xs font-bold uppercase tracking-wide ${p.accent}`}
          >
            {p.tagline}
          </p>
          <h3 className="mt-0.5 break-words font-display text-lg font-extrabold leading-tight text-white">
            {p.name}
          </h3>
        </div>
        <Image
          src={p.art}
          alt=""
          width={72}
          height={72}
          aria-hidden
          className={`h-14 w-14 shrink-0 select-none object-contain drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] transition-transform duration-300 ${p.rotate} group-hover:rotate-0 group-hover:scale-110`}
        />
      </div>
      <TechLogos name={p.name} />
      <p className="text-sm leading-relaxed text-white/65">{p.description}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-bold text-thunder-yellow transition group-hover:gap-2.5">
        <GithubMark />
        GitHub で見る
        <span aria-hidden>→</span>
      </span>
    </a>
  );
}

export function ProductShowcase() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PRODUCTS.map((p) => (
        <ProductCard key={p.name} p={p} />
      ))}
    </div>
  );
}
