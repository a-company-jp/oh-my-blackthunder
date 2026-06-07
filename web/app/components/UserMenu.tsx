"use client";

// Signed-in avatar + popover with profile link and sign-out.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth-context";

export function UserMenu() {
  const { login, githubId, avatarUrl, displayName, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handle = login ? `@${login}` : displayName ?? "ユーザー";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border-2 border-thunder-black bg-thunder-ink/80 py-1 pl-1 pr-3 transition hover:brightness-110"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={32}
            height={32}
            className="rounded-full border-2 border-thunder-yellow"
          />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-thunder-yellow bg-thunder-black text-sm">
            ⚡
          </span>
        )}
        <span className="hidden max-w-[10rem] truncate text-sm font-bold sm:inline">
          {handle}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="bt-panel absolute right-0 z-30 mt-2 w-48 overflow-hidden p-1 text-sm"
        >
          {githubId ? (
            <Link
              role="menuitem"
              href={`/u/${githubId}`}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 font-bold transition hover:bg-thunder-yellow/15"
            >
              マイページ
            </Link>
          ) : null}
          <Link
            role="menuitem"
            href="/teams"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 font-bold transition hover:bg-thunder-yellow/15"
          >
            マイチーム
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="block w-full rounded-lg px-3 py-2 text-left font-bold text-thunder-red transition hover:bg-thunder-red/15"
          >
            サインアウト
          </button>
        </div>
      ) : null}
    </div>
  );
}
