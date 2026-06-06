"use client";

// ---------------------------------------------------------------------------
// EasterEggProvider — the single global mount point for the playful hidden
// features. Mounted once in app/layout.tsx. It wires together:
//   • Konami code (↑↑↓↓←→←→ B A) -> toggle ⚡ザクザクモード⚡ (full-screen rain).
//   • Typing "zakuzaku" anywhere -> a brief screen-crunch shake + a toast.
//   • A subtle lightning cursor trail.
//   • An occasional monster strolling across the footer.
//
// All motion is gated on prefers-reduced-motion (each child handles its own
// gating; the shake is also skipped here). Audio only fires from explicit user
// gestures (e.g. clicking the strolling monster) — never on load.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";

import { CursorTrail } from "@/app/components/eastereggs/CursorTrail";
import { EggToast } from "@/app/components/eastereggs/EggToast";
import { StrollingMonster } from "@/app/components/eastereggs/StrollingMonster";
import { ZakuzakuMode } from "@/app/components/eastereggs/ZakuzakuMode";
import { useKonami } from "@/app/components/eastereggs/useKonami";
import { useReducedMotion } from "@/app/components/eastereggs/useReducedMotion";
import { useSecretWord } from "@/app/components/eastereggs/useSecretWord";

const SECRET_WORDS = ["zakuzaku"] as const;

export function EasterEggProvider() {
  const reduced = useReducedMotion();
  const [zakuMode, setZakuMode] = useState(false);
  const [toast, setToast] = useState<{ n: number; msg: string }>({
    n: 0,
    msg: "",
  });
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast((t) => ({ n: t.n + 1, msg }));
  }, []);

  // Konami -> toggle ザクザクモード (toast either way, so reduced-motion users
  // still get the payoff).
  useKonami(
    useCallback(() => {
      setZakuMode((on) => {
        const next = !on;
        showToast(next ? "⚡ザクザクモード ON⚡" : "ザクザクモード OFF");
        return next;
      });
    }, [showToast]),
  );

  // "zakuzaku" -> screen crunch shake + crumbs toast.
  useSecretWord(
    SECRET_WORDS,
    useCallback(() => {
      showToast("ザクザク！🍫");
      if (reduced) return;
      const body = document.body;
      body.classList.remove("bt-shake");
      // Force reflow so re-adding the class restarts the animation.
      void body.offsetWidth;
      body.classList.add("bt-shake");
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(
        () => body.classList.remove("bt-shake"),
        600,
      );
    }, [reduced, showToast]),
  );

  // Cleanup any lingering shake on unmount.
  useEffect(() => {
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      document.body.classList.remove("bt-shake");
    };
  }, []);

  return (
    <>
      <CursorTrail />
      <StrollingMonster />
      <ZakuzakuMode active={zakuMode} />
      <EggToast trigger={toast.n} message={toast.msg} />
    </>
  );
}
