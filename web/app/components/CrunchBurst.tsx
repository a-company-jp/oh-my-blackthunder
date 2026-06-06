"use client";

// ---------------------------------------------------------------------------
// A short-lived "ザクザク!" burst of bar-piece crumbs + a lightning glyph,
// fired when a score / count increases. Self-unmounts after the animation, and
// renders nothing under prefers-reduced-motion.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";

interface CrunchBurstProps {
  /** Bump this to (re)fire the burst. */
  trigger: number;
  /** Optional label shown above the crumbs (default: "ザクザク!"). */
  label?: string;
}

interface Crumb {
  id: number;
  dx: number;
  dy: number;
  rot: number;
  delay: number;
  scale: number;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function buildCrumbs(): Crumb[] {
  const count = 9;
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.PI * (i / (count - 1)) - Math.PI / 2; // fan upward
    const dist = 36 + Math.random() * 44;
    return {
      id: i,
      dx: Math.cos(angle) * dist,
      dy: -Math.abs(Math.sin(angle) * dist) - 18,
      rot: (Math.random() - 0.5) * 320,
      delay: Math.random() * 60,
      scale: 0.6 + Math.random() * 0.7,
    };
  });
}

export function CrunchBurst({ trigger, label = "ザクザク!" }: CrunchBurstProps) {
  const [active, setActive] = useState(false);

  // Recompute the random crumb fan on each fire (trigger bump).
  const crumbs = useMemo<Crumb[]>(() => buildCrumbs(), [trigger]);

  useEffect(() => {
    if (trigger <= 0) return;
    if (prefersReducedMotion()) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 750);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
    >
      <span className="bt-crunch-label font-display text-lg font-extrabold text-thunder-yellow">
        {label}
      </span>
      {crumbs.map((c) => (
        <span
          key={c.id}
          className="bt-crumb"
          style={
            {
              "--dx": `${c.dx}px`,
              "--dy": `${c.dy}px`,
              "--rot": `${c.rot}deg`,
              "--delay": `${c.delay}ms`,
              "--scale": c.scale,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
