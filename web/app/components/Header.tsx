"use client";

// Sticky top bar: wordmark home link + primary nav + auth controls. The nav
// collapses into a slide-down mobile menu under md.
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";

import { SignInButton } from "@/app/components/SignInButton";
import { UserMenu } from "@/app/components/UserMenu";
import { useAuth } from "@/lib/auth-context";

const NAV_LINKS: { href: string; label: string; emoji: string }[] = [
  { href: "/", label: "ホーム", emoji: "🏠" },
  { href: "/leaderboard", label: "ランキング", emoji: "🏆" },
  { href: "/teams", label: "チーム", emoji: "🤝" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-thunder-black bg-thunder-black/80 backdrop-blur supports-[backdrop-filter]:bg-thunder-black/60">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 transition hover:brightness-110"
          aria-label="ホーム — Black Thunder"
        >
          <Image
            src="/assets/logo/blackthunder-wordmark.png"
            alt="Black Thunder"
            width={148}
            height={32}
            priority
            className="h-7 w-auto sm:h-8"
          />
          <span className="hidden font-display text-xs font-bold text-thunder-yellow/80 lg:inline">
            ⚡ザクザク開発
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="メインナビゲーション">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
              className={clsx(
                "rounded-full px-3 py-2 font-display text-sm font-extrabold transition",
                isActive(pathname, link.href)
                  ? "bg-thunder-yellow text-thunder-black"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {loading ? (
            <span className="bt-spinner-sm" aria-hidden />
          ) : user ? (
            <UserMenu />
          ) : (
            <SignInButton className="px-3 py-2 text-sm" />
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="メニューを開閉"
            aria-expanded={mobileOpen}
            aria-controls="bt-mobile-nav"
            className="grid h-10 w-10 place-items-center rounded-xl border-2 border-thunder-black bg-thunder-ink/80 transition hover:brightness-110 md:hidden"
          >
            <span className="relative block h-4 w-5" aria-hidden>
              <span
                className={clsx(
                  "absolute left-0 h-0.5 w-5 bg-thunder-yellow transition-all",
                  mobileOpen ? "top-1.5 rotate-45" : "top-0",
                )}
              />
              <span
                className={clsx(
                  "absolute left-0 top-1.5 h-0.5 w-5 bg-thunder-yellow transition-opacity",
                  mobileOpen && "opacity-0",
                )}
              />
              <span
                className={clsx(
                  "absolute left-0 h-0.5 w-5 bg-thunder-yellow transition-all",
                  mobileOpen ? "top-1.5 -rotate-45" : "top-3",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen ? (
        <nav
          id="bt-mobile-nav"
          aria-label="モバイルナビゲーション"
          className="border-t-2 border-thunder-black bg-thunder-black/95 px-4 py-3 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={
                    isActive(pathname, link.href) ? "page" : undefined
                  }
                  className={clsx(
                    "flex items-center gap-2 rounded-xl px-3 py-3 font-display text-base font-extrabold transition",
                    isActive(pathname, link.href)
                      ? "bg-thunder-yellow text-thunder-black"
                      : "text-white/80 hover:bg-white/10",
                  )}
                >
                  <span aria-hidden>{link.emoji}</span>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
