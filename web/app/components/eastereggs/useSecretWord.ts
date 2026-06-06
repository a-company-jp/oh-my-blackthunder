"use client";

// ---------------------------------------------------------------------------
// useSecretWord — fires `onMatch` when the user types a secret word anywhere on
// the page (outside of form fields). Keeps a rolling buffer the length of the
// longest word and checks for a suffix match on every keystroke.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";

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

/**
 * @param words  lowercase words to listen for (latin letters)
 * @param onMatch called with the matched word
 */
export function useSecretWord(
  words: readonly string[],
  onMatch: (word: string) => void,
): void {
  const cbRef = useRef(onMatch);
  useEffect(() => {
    cbRef.current = onMatch;
  }, [onMatch]);

  useEffect(() => {
    const maxLen = words.reduce((m, w) => Math.max(m, w.length), 0);
    if (maxLen === 0) return;
    let buffer = "";

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (e.key.length !== 1) return; // ignore arrows, modifiers, etc.
      const ch = e.key.toLowerCase();
      if (ch < "a" || ch > "z") {
        buffer = "";
        return;
      }
      buffer = (buffer + ch).slice(-maxLen);
      for (const w of words) {
        if (buffer.endsWith(w)) {
          buffer = "";
          cbRef.current(w);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [words]);
}
