"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 800;

/**
 * Animates a number (count-up) over ~800 ms via requestAnimationFrame.
 * Automatically disabled when the user prefers reduced motion.
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

    // Reduced motion: snap the displayed value to the target,
    // inside an async callback (never call setState synchronously here).
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
