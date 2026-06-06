"use client";

// ---------------------------------------------------------------------------
// Decorative bolt-rain: a field of falling ⚡ glyphs drifting down the hero.
// Purely ornamental (aria-hidden) and disabled under prefers-reduced-motion
// (handled by the .bt-bolt-rain { display:none } rule in globals.css).
//
// Positions/delays/durations are seeded deterministically so server and client
// render the same markup (no hydration mismatch).
// ---------------------------------------------------------------------------

import { useMemo } from "react";

interface BoltRainProps {
  /** How many bolts to scatter. */
  count?: number;
  className?: string;
}

interface Bolt {
  x: number; // left %
  size: number; // px
  delay: number; // s
  dur: number; // s
  glyph: string;
}

// Small deterministic PRNG so SSR and CSR agree.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GLYPHS = ["⚡", "⚡", "⚡", "🍫", "✦"];

export function BoltRain({ count = 22, className }: BoltRainProps) {
  const bolts = useMemo<Bolt[]>(() => {
    const rand = mulberry32(0x2acb);
    return Array.from({ length: count }, () => ({
      x: rand() * 100,
      size: 12 + rand() * 22,
      delay: rand() * 2.4,
      dur: 2 + rand() * 2.6,
      glyph: GLYPHS[Math.floor(rand() * GLYPHS.length)],
    }));
  }, [count]);

  return (
    <div aria-hidden className={`bt-bolt-rain ${className ?? ""}`}>
      {bolts.map((b, i) => (
        <span
          key={i}
          className="bt-bolt"
          style={
            {
              "--x": `${b.x}%`,
              "--size": `${b.size}px`,
              "--delay": `${b.delay}s`,
              "--dur": `${b.dur}s`,
            } as React.CSSProperties
          }
        >
          {b.glyph}
        </span>
      ))}
    </div>
  );
}
