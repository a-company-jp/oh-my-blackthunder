"use client";

// ---------------------------------------------------------------------------
// useKonami — fires `onUnlock` when the Konami code is entered:
//   ↑ ↑ ↓ ↓ ← → ← → B A
// Also matches the swipe-friendly tail (B/A) case-insensitively. Listens on the
// window with a rolling buffer; ignores keystrokes while typing in an input so
// it never collides with the "zakuzaku" word listener or form fields.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";

const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function useKonami(onUnlock: () => void): void {
  // Keep the latest callback in a ref so we register the listener once.
  const cbRef = useRef(onUnlock);
  useEffect(() => {
    cbRef.current = onUnlock;
  }, [onUnlock]);

  useEffect(() => {
    const buffer: string[] = [];

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      // Normalize letter keys; keep arrow key names as-is.
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      buffer.push(key);
      if (buffer.length > SEQUENCE.length) buffer.shift();
      if (buffer.length !== SEQUENCE.length) return;
      for (let i = 0; i < SEQUENCE.length; i += 1) {
        if (buffer[i] !== SEQUENCE[i]) return;
      }
      buffer.length = 0;
      cbRef.current();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
