import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-16 text-center">
      <Image
        src="/assets/monster/gusu.png"
        alt=""
        width={160}
        height={160}
        className="bt-monster h-32 w-auto animate-boltDrop"
        aria-hidden
      />
      <h1 className="bt-stroke-lg font-display text-5xl font-extrabold text-thunder-yellow">
        404
      </h1>
      <p className="font-display text-xl font-extrabold text-white">
        ページが見つかりません
      </p>
      <p className="max-w-md text-sm text-white/60">
        お探しのページは、ザクザク食べられてしまったようです。
      </p>
      <Link href="/" className="bt-button">
        ランキングへ戻る
      </Link>
    </div>
  );
}
