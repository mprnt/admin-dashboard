'use client';

import React from 'react';
import { useMounted } from './motion';

/**
 * A printer's paper as a tank of liquid, the level rising and falling with the
 * stock. The surface moves while the printer is online. It stays still when it
 * is offline or the level is unknown, so motion never implies a live reading
 * that is not there.
 */
export function PaperTank({
  value,
  live = true,
  width = 44,
  height = 92,
}: {
  value: number | null;
  live?: boolean;
  width?: number;
  height?: number;
}) {
  const mounted = useMounted(80);
  const id = React.useId();

  if (value === null) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-border text-[10px] text-text-muted"
        style={{ width, height }}
        role="img"
        aria-label="Paper level not reported"
      >
        n/a
      </div>
    );
  }

  const low = value < 20;
  const fill = low ? 'rgb(var(--color-warning))' : 'rgb(var(--color-primary))';
  const level = mounted ? value : 0;
  const inner = height - 8;
  const surfaceY = 4 + (1 - level / 100) * inner;

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-xl border border-border bg-surface-sunken"
      style={{ width, height }}
      role="img"
      aria-label={`Paper ${value}%${low ? ', running low' : ''}`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full">
        <defs>
          <clipPath id={`clip-${id}`}>
            <rect x="0" y={surfaceY} width={width} height={height} />
          </clipPath>
          <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="0.85" />
            <stop offset="100%" stopColor={fill} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#clip-${id})`} className="transition-[transform] duration-700 ease-out">
          <rect x="0" y={surfaceY} width={width} height={height} fill={`url(#fill-${id})`} />
          <g className={live ? 'wave-x' : ''} style={{ transformBox: 'fill-box' }}>
            <path
              d={`M0,${surfaceY} q ${width / 4},-4 ${width / 2},0 t ${width / 2},0 t ${width / 2},0 t ${width / 2},0 V${height} H0 Z`}
              fill={fill}
              fillOpacity="0.9"
            />
          </g>
        </g>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={6} y1={4 + f * inner} y2={4 + f * inner} stroke="rgb(var(--color-text-muted))" strokeOpacity="0.5" />
        ))}
      </svg>
      <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[11px] font-semibold tabular text-surface mix-blend-difference">
        {value}%
      </span>
    </div>
  );
}
