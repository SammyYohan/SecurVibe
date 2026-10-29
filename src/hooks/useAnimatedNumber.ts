"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 800;

/**
 * Anime un nombre (count-up) sur ~800 ms via requestAnimationFrame.
 * Désactivé automatiquement si l'utilisateur préfère réduire les animations.
 */
export function useAnimatedNumber(
  target: number,
  durationMs: number = DEFAULT_DURATION_MS,
): number {
  const [display, setDisplay] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Animations réduites : aligner la valeur affichée sur la cible,
    // dans un callback asynchrone (jamais setState de façon synchrone ici).
    if (reduceMotion || durationMs <= 0) {
      const frame = requestAnimationFrame(() => {
        currentRef.current = target;
        setDisplay(target);
      });
      return () => {
        cancelAnimationFrame(frame);
      };
    }

    const from = currentRef.current;
    if (from === target) return;

    const start = performance.now();

    const tick = (now: number): void => {
      const linear = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - linear, 3); // easeOutCubic
      const value = Math.round(from + (target - from) * eased);
      currentRef.current = value;
      setDisplay(value);
      if (linear < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    let frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target, durationMs]);

  return display;
}
