'use client';

import React from 'react';

/**
 * Eases a number towards its new value, so a figure that changes reads as
 * movement rather than a jump. The first value is taken as-is: nothing counts
 * up on page load, which would look like a bug on a slow connection. With
 * reduced motion requested, the number simply changes.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = React.useState(target);
  const previous = React.useRef(target);

  React.useEffect(() => {
    const from = previous.current;
    const to = target;
    previous.current = target;
    if (from === to) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }

    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

/** Runs once, shortly after mount, so CSS transitions have a start state to leave from. */
export function useMounted(delay = 60): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), delay);
    return () => window.clearTimeout(t);
  }, [delay]);
  return mounted;
}
