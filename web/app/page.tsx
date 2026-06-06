import Image from "next/image";
import Link from "next/link";

import { BoltRain } from "@/app/components/BoltRain";
import { ProductShowcase } from "@/app/components/ProductShowcase";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-thunder-black bg-thunder-ink/70 px-5 py-12 text-center sm:px-8 sm:py-16">
        <BoltRain count={26} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-thunderFlash bg-thunder-yellow/10"
        />
        <div className="relative flex flex-col items-center gap-6">
          <Image
            src="/assets/logo/blackthunder-wordmark.png"
            alt="Black Thunder"
            width={520}
            height={114}
            priority
            className="h-16 w-auto animate-boltDrop sm:h-24"
          />
          <h1 className="bt-stroke-lg font-display text-3xl font-extrabold leading-tight text-thunder-yellow sm:text-5xl">
            ザクザク開発、はじめよう。
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
            AI利用で消費したブラックサンダーの本数
            <span className="font-bold text-thunder-yellow">（AIザクザク度）</span>
            と、「食べた！」と宣言した回数
            <span className="font-bold text-white">（ブラックサンダーカウント）</span>
            を、リアルタイムで競うエコシステム。⚡ザクザク開発、
            <span className="font-bold text-thunder-yellow">BTDD</span>
            （Black Thunder Driven Development）。
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/leaderboard" className="bt-button text-base">
              🏆 ランキングを見る
            </Link>
            <Link href="/teams" className="bt-button-red text-base">
              🤝 チームに参加する
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Image
              src="/assets/sticker/zakuzaku-hack.png"
              alt=""
              width={120}
              height={120}
              className="h-16 w-auto -rotate-6"
              aria-hidden
            />
            <Image
              src="/assets/sticker/btdd.png"
              alt=""
              width={120}
              height={120}
              className="h-16 w-auto rotate-3"
              aria-hidden
            />
            <Image
              src="/assets/sticker/lgtm.png"
              alt=""
              width={120}
              height={120}
              className="h-16 w-auto -rotate-2"
              aria-hidden
            />
          </div>
        </div>
      </section>

      {/* Product showcase */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="bt-stroke font-display text-2xl font-extrabold text-white sm:text-3xl">
            ⚡ プロダクト一覧
          </h2>
          <p className="max-w-xl text-sm text-white/60">
            ターミナルからエディタ、ブラウザ、メニューバーまで。あらゆる開発の現場にブラックサンダーを。
          </p>
        </div>
        <ProductShowcase />
      </section>

      {/* What is BTDD */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            emoji: "🍫",
            title: "AIザクザク度",
            body: "AIにコードを書かせるたびに、消費したブラックサンダーの本数が積み上がる。あなたのAI活用度をザクザク可視化。",
          },
          {
            emoji: "✅",
            title: "ブラックサンダーカウント",
            body: "実際に食べたら「食べた！」を宣言。Chrome拡張のチェックボックスやWebボタンから、回数をカウント。",
          },
          {
            emoji: "🤝",
            title: "チームで競う",
            body: "仲間とチームを組んで、合計のAIザクザク度を競おう。招待リンクやユーザー名で、誰でもすぐに参加できる。",
          },
        ].map((f) => (
          <div key={f.title} className="bt-panel flex flex-col gap-2 p-5">
            <span className="text-3xl" aria-hidden>
              {f.emoji}
            </span>
            <h3 className="font-display text-lg font-extrabold text-thunder-yellow">
              {f.title}
            </h3>
            <p className="text-sm leading-relaxed text-white/65">{f.body}</p>
          </div>
        ))}
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-thunder-black bg-gradient-to-br from-thunder-ink to-thunder-black px-5 py-10 text-center sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-thunder-radial opacity-70"
        />
        <div className="relative flex flex-col items-center gap-5">
          <Image
            src="/assets/monster/niko.png"
            alt=""
            width={120}
            height={120}
            aria-hidden
            className="bt-monster h-24 w-auto animate-boltDrop drop-shadow-[0_8px_0_rgba(0,0,0,0.6)]"
          />
          <h2 className="bt-stroke font-display text-2xl font-extrabold text-white sm:text-3xl">
            さあ、あなたもザクザクしよう
          </h2>
          <p className="max-w-md text-sm text-white/65">
            GitHubでサインインして、AIザクザク度ランキングに参戦。今日の一本から、伝説のザクザクエンジニアへ。
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/leaderboard" className="bt-button text-base">
              ランキングへ ⚡
            </Link>
            <Link href="/teams" className="bt-button text-base bg-white">
              チームを作る 🤝
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-3 border-t-2 border-dashed border-white/10 pt-8 text-center">
        <Image
          src="/assets/logo/blackthunder-wordmark.png"
          alt="Black Thunder"
          width={180}
          height={40}
          className="h-7 w-auto opacity-80"
        />
        <p className="text-xs text-white/45">
          ブラックサンダーは{" "}
          <a
            href="https://www.yurakuseika.co.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-white/60 underline-offset-2 transition hover:text-thunder-yellow hover:underline"
          >
            有楽製菓株式会社
          </a>{" "}
          の登録商標です。
        </p>
        <p className="text-xs text-white/45">
          ⚡ ブラッカソン作品 — Made with ❤️ by{" "}
          <a
            href="https://github.com/a-company-jp"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-white/70 underline-offset-2 transition hover:text-thunder-yellow hover:underline"
          >
            あカンパニー / Acompany
          </a>
        </p>
      </footer>
    </div>
  );
}
