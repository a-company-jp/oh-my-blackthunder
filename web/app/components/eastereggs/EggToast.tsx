"use client";

// ---------------------------------------------------------------------------
// A small Black-Thunder styled toast for easter-egg feedback. Pops in from the
// top, auto-dismisses, and respects reduced-motion (no slide, just appears).
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import clsx from "clsx";

import { useReducedMotion } from "@/app/components/eastereggs/useReducedMotion";

interface EggToastProps {
  /** Bump to (re)show with new text; 0 = hidden. */
  trigger: number;
  message: string;
  durationMs?: number;
}

export function EggToast({ trigger, message, durationMs = 2600 }: EggToastProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (trigger <= 0) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), durationMs);
    return () => clearTimeout(t);
  }, [trigger, durationMs]);

  if (!shown) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4"
    >
      <div
        className={clsx(
          "bt-panel flex items-center gap-2 px-4 py-2.5 font-display text-sm font-extrabold text-thunder-yellow",
          !reduced && "animate-boltDrop",
        )}
      >
        {message}
      </div>
    </div>
  );
}
