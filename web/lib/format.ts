"use client";

// ---------------------------------------------------------------------------
// Display formatting helpers + a count-up animation hook.
// formatBars is re-exported from the shared schema so callers have one import.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";

import { formatBars } from "@/lib/shared/schema";

export { formatBars };

/** Japanese relative-time, e.g. "たった今", "5分前", "3日前". */
export function relativeTimeJa(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const diff = Date.now() - ms;
  if (diff < 0) return "たった今";

  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "たった今";
  if (sec < 60) return `${sec}秒前`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分前`;

  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;

  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}日前`;

  const week = Math.floor(day / 7);
  if (week < 5) return `${week}週間前`;

  const month = Math.floor(day / 30);
  if (month < 12) return `${month}ヶ月前`;

  const year = Math.floor(day / 365);
  return `${year}年前`;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Smoothly counts the displayed number up (or jumps, on reduced-motion) toward
 * `value`. Returns the current animated number.
 */
export function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }

    startRef.current = 0;
    const step = (now: number) => {
      if (startRef.current === 0) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(to);
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, durationMs]);

  return display;
}
