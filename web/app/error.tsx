"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error in dev tools; production telemetry hooks could go here.
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-5 px-6 py-16 text-center">
      <Image
        src="/assets/sticker/error.png"
        alt=""
        width={160}
        height={160}
        className="h-32 w-auto animate-boltDrop"
        aria-hidden
      />
      <h1 className="bt-stroke font-display text-3xl font-extrabold text-thunder-red">
        ザクザク エラー
      </h1>
      <p className="max-w-md text-sm text-white/60">
        予期しないエラーが発生しました。もう一度お試しください。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="bt-button">
          もう一度試す
        </button>
        <Link href="/" className="bt-button-red">
          ホームへ
        </Link>
      </div>
    </div>
  );
}
