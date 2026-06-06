"use client";

// ---------------------------------------------------------------------------
// A Black Thunder monster that occasionally strolls across the bottom of the
// viewport, then leaves. Picks a random monster + direction each trip, waits a
// random idle gap, and repeats. Click it for a little bounce + crunch sound
// (audio only fires from this explicit click gesture). Reduced-motion: never
// mounts the walk. aria-hidden — purely decorative.
// ---------------------------------------------------------------------------

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { playCrunch } from "@/app/components/eastereggs/crunchSound";
import { useReducedMotion } from "@/app/components/eastereggs/useReducedMotion";

const MONSTERS = [
  "/assets/monster/niko.png",
  "/assets/monster/ike.png",
  "/assets/monster/gusu.png",
  "/assets/monster/wi.png",
];

interface Trip {
  src: string;
  fromRight: boolean;
  durMs: number;
}

function randomTrip(): Trip {
  return {
    src: MONSTERS[Math.floor(Math.random() * MONSTERS.length)],
    fromRight: Math.random() < 0.5,
    durMs: 11000 + Math.random() * 7000,
  };
}

export function StrollingMonster() {
  const reduced = useReducedMotion();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [bounce, setBounce] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;

    const schedule = (delay: number) => {
      const t = setTimeout(() => {
        if (cancelled) return;
        const next = randomTrip();
        setTrip(next);
        const end = setTimeout(() => {
          if (cancelled) return;
          setTrip(null);
          schedule(14000 + Math.random() * 16000); // idle gap before next trip
        }, next.durMs);
        timers.current.push(end);
      }, delay);
      timers.current.push(t);
    };

    schedule(6000 + Math.random() * 6000); // first appearance

    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [reduced]);

  const onClick = useCallback(() => {
    setBounce(true);
    playCrunch();
    setTimeout(() => setBounce(false), 460);
  }, []);

  if (reduced || !trip) return null;

  return (
    <button
      type="button"
      aria-label="ブラックサンダーモンスター"
      onClick={onClick}
      className="fixed bottom-1 z-30 cursor-pointer select-none border-0 bg-transparent p-0"
      style={
        {
          left: trip.fromRight ? undefined : "-80px",
          right: trip.fromRight ? "-80px" : undefined,
          animation: `bt-stroll-${trip.fromRight ? "rtl" : "ltr"} ${trip.durMs}ms linear forwards`,
        } as React.CSSProperties
      }
    >
      {/* Stroll lives on the button; the bounce + flip live on the inner image
          so the two transforms/animations don't clobber each other. */}
      <Image
        src={trip.src}
        alt=""
        width={56}
        height={56}
        unoptimized
        aria-hidden
        className={clsx(
          "h-12 w-auto drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]",
          trip.fromRight && "-scale-x-100",
          bounce && "animate-crunchPop",
        )}
      />
    </button>
  );
}
