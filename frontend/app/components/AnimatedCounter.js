'use client';
import { useEffect, useRef } from 'react';

/**
 * AnimatedCounter — counts up from 0 to `target` with an easing curve.
 * Usage: <AnimatedCounter target={42} duration={1200} color="#10b981" />
 */
export default function AnimatedCounter({ target, duration = 1200, color, prefix = '', suffix = '' }) {
  const ref = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target === undefined || target === null || ref.current === null) return;

    const start = performance.now();
    const from = 0;
    const to = Number(target);

    const easeOut = (t) => 1 - Math.pow(1 - t, 4); // Quartic ease-out

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const value = Math.round(from + (to - from) * easeOut(progress));

      if (ref.current) {
        ref.current.textContent = prefix + value.toLocaleString() + suffix;
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, prefix, suffix]);

  return (
    <span
      ref={ref}
      style={{
        color,
        fontVariantNumeric: 'tabular-nums',
        display: 'inline-block',
        minWidth: '2ch',
      }}
    >
      {prefix}0{suffix}
    </span>
  );
}
