"use client";

// ---------------------------------------------------------------------------
// ⚡ザクザクモード⚡ — the Konami-code payoff. A full-screen rain of Black
// Thunder bars + monsters with intermittent thunder flashes. Pointer-events are
// disabled so the page stays usable underneath. Rendered as a no-op when
// reduced-motion is on (the parent still shows a toast instead).
// ---------------------------------------------------------------------------

import Image from "next/image";
import { useMemo } from "react";

import { useReducedMotion } from "@/app/components/eastereggs/useReducedMotion";

const FALLERS = [
  "/assets/product/bar.png",
  "/assets/product/bar-piece.png",
  "/assets/monster/niko.png",
  "/assets/monster/ike.png",
  "/assets/monster/gusu.png",
  "/assets/monster/wi.png",
];

interface Faller {
  src: string;
  x: number; // left %
  size: number; // px
  delay: number; // s
  dur: number; // s
  drift: number; // px
  rot: number; // deg
}

function buildFallers(count: number): Faller[] {
  return Array.from({ length: count }, (_, i) => ({
    src: FALLERS[i % FALLERS.length],
    x: Math.random() * 100,
    size: 36 + Math.random() * 56,
    delay: Math.random() * 3.4,
    dur: 2.6 + Math.random() * 2.8,
    drift: (Math.random() - 0.5) * 120,
    rot: (Math.random() - 0.5) * 720,
  }));
}

export function ZakuzakuMode({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  // Recompute on each activation so the rain looks fresh.
  const fallers = useMemo<Faller[]>(
    () => (active ? buildFallers(28) : []),
    [active],
  );

  if (!active || reduced) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[55] overflow-hidden"
    >
      {/* Thunder flashes layered over the rain. */}
      <div className="absolute inset-0 animate-thunderFlash bg-thunder-yellow/15" />
      {fallers.map((f, i) => (
        <Image
          key={i}
          src={f.src}
          alt=""
          width={Math.round(f.size)}
          height={Math.round(f.size)}
          unoptimized
          className="bt-fall select-none drop-shadow-[0_6px_0_rgba(0,0,0,0.5)]"
          style={
            {
              "--x": `${f.x}%`,
              "--size": `${f.size}px`,
              "--delay": `${f.delay}s`,
              "--dur": `${f.dur}s`,
              "--drift": `${f.drift}px`,
              "--rot": `${f.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
