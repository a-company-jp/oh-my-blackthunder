"use client";

// ---------------------------------------------------------------------------
// Subtle lightning cursor trail. Drops a small ⚡ spark behind the pointer,
// throttled to a steady cadence so it never floods the DOM. Each spark removes
// itself on animationend. Disabled under reduced-motion and on coarse (touch)
// pointers where there is no cursor to trail.
// ---------------------------------------------------------------------------

import { useEffect } from "react";

import { useReducedMotion } from "@/app/components/eastereggs/useReducedMotion";

const MIN_INTERVAL_MS = 70; // throttle: at most ~14 sparks/sec
const GLYPHS = ["⚡", "✦"];

export function CursorTrail() {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (typeof window === "undefined") return;
    // Only on fine pointers (mouse/trackpad).
    if (!window.matchMedia?.("(pointer: fine)").matches) return;

    let lastAt = 0;

    const onMove = (e: PointerEvent) => {
      const now = e.timeStamp;
      if (now - lastAt < MIN_INTERVAL_MS) return;
      lastAt = now;

      const spark = document.createElement("span");
      spark.className = "bt-spark";
      spark.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      spark.setAttribute("aria-hidden", "true");
      spark.style.left = `${e.clientX}px`;
      spark.style.top = `${e.clientY}px`;
      spark.style.setProperty("--spark-size", `${10 + Math.random() * 8}px`);
      spark.addEventListener(
        "animationend",
        () => spark.remove(),
        { once: true },
      );
      document.body.appendChild(spark);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      // Sweep up any sparks still mid-fade on unmount.
      document.querySelectorAll(".bt-spark").forEach((el) => el.remove());
    };
  }, [reduced]);

  return null;
}
