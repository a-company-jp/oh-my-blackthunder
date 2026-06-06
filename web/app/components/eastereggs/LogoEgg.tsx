"use client";

// ---------------------------------------------------------------------------
// Wraps the header wordmark: click it N times in quick succession to set off a
// CrunchBurst of bar-piece crumbs + a little crunch jingle. The click count
// resets if you pause, so it stays a "secret". Audio fires only from the click
// (a user gesture) and never on load. Reuses the existing CrunchBurst effect,
// which already no-ops under reduced-motion.
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from "react";

import { CrunchBurst } from "@/app/components/CrunchBurst";
import { playCrunch } from "@/app/components/eastereggs/crunchSound";

const NEEDED = 5; // clicks to unlock
const RESET_MS = 1200; // gap that resets the streak

export function LogoEgg({ children }: { children: React.ReactNode }) {
  const [burst, setBurst] = useState(0);
  const countRef = useRef(0);
  const lastRef = useRef(0);

  const onClick = useCallback(() => {
    const now = Date.now();
    countRef.current = now - lastRef.current > RESET_MS ? 1 : countRef.current + 1;
    lastRef.current = now;
    if (countRef.current >= NEEDED) {
      countRef.current = 0;
      setBurst((n) => n + 1);
      playCrunch();
    }
  }, []);

  return (
    <span className="relative" onClickCapture={onClick}>
      {children}
      <CrunchBurst trigger={burst} label="ザクザク!⚡" />
    </span>
  );
}
