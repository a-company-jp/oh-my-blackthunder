"use client";

// ---------------------------------------------------------------------------
// useTilt — a tiny 3D parallax tilt for cards. Returns a single callback `ref`
// to attach to an element; the hook wires the pointer listeners itself and
// applies the tilt straight to element.style inside a rAF, so React never
// re-renders on pointer move (keeps the grid / leaderboard smooth). Disabled
// under reduced-motion and on coarse pointers.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef } from "react";

import { useReducedMotion } from "@/app/components/eastereggs/useReducedMotion";

const MAX_DEG = 7;

export function useTilt<T extends HTMLElement = HTMLElement>() {
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  const elRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Callback ref: (un)wires listeners as the node mounts / unmounts.
  const ref = useCallback((node: T | null) => {
    // Tear down previous node's listeners.
    cleanupRef.current?.();
    cleanupRef.current = null;
    elRef.current = node;
    if (!node) return;

    const fine =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(pointer: fine)").matches;
    if (!fine) return;

    const onMove = (e: PointerEvent) => {
      if (reducedRef.current) return;
      const rect = node.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      const rotY = px * MAX_DEG * 2;
      const rotX = -py * MAX_DEG * 2;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        node.style.transform = `perspective(700px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-4px)`;
      });
    };
    const onLeave = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      node.style.transform = "";
    };

    node.addEventListener("pointermove", onMove, { passive: true });
    node.addEventListener("pointerleave", onLeave);
    cleanupRef.current = () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  return ref;
}
