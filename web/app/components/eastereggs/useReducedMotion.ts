"use client";

// ---------------------------------------------------------------------------
// Reactive `prefers-reduced-motion` hook. Mirrors the one-off checks scattered
// across the codebase (CrunchBurst, LeaderboardRow, lib/format) but stays live:
// if the user flips the OS setting while the page is open, the value updates so
// every easter egg can gate its motion.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  // Start `false` so server + first client render agree (no hydration
  // mismatch); we correct it in the effect once `matchMedia` is available.
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
