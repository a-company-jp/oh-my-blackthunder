"use client";

// ---------------------------------------------------------------------------
// A tiny, dependency-free "ザクザク" crunch jingle built with the Web Audio API.
// IMPORTANT: only ever call playCrunch() from within a real user gesture
// (click / keydown). The AudioContext is created lazily on first use, so we
// never autoplay or hold audio resources before the user opts in. There is no
// background music and nothing loops.
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/**
 * Play a short crunch: a couple of filtered noise bursts that read as a
 * snappy "ザク…ザク". Safe to call repeatedly; no-ops if Web Audio is missing.
 */
export function playCrunch(): void {
  const ac = getContext();
  if (!ac) return;
  // Browsers may suspend the context until a gesture resumes it.
  if (ac.state === "suspended") void ac.resume();

  const now = ac.currentTime;
  // Two crunch bursts -> "ザク ザク".
  [0, 0.12].forEach((offset) => {
    const start = now + offset;
    const dur = 0.09;

    // White-noise buffer for the crunchy texture.
    const frames = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      // Decaying noise so each burst is a crisp tick.
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;

    const bandpass = ac.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 2200;
    bandpass.Q.value = 0.8;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    src.connect(bandpass).connect(gain).connect(ac.destination);
    src.start(start);
    src.stop(start + dur);
  });
}
