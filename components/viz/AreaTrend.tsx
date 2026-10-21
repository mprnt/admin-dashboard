'use client';

import React from 'react';
import type { SeriesPoint } from '@/lib/api';
import { currency, number, dateOnly } from '@/lib/format';

/**
 * The period's trend as a smooth area. Move a finger or the pointer across it
 * and a crosshair follows, with the day's figure in a tooltip. The arrow keys do
 * the same for keyboard users. The same figures are also in a visually hidden
 * table, so a screen reader gets them without the picture.
 */
export type TrendMetric = 'revenue' | 'jobs';

const W = 640;
const PAD = { left: 10, right: 10, top: 18, bottom: 30 };

export function AreaTrend({
  series,
  metric,
  height = 230,
}: {
  series: SeriesPoint[];
  metric: TrendMetric;
  height?: number;
}) {
  const [active, setActive] = React.useState<number | null>(null);
  const H = height;
  const n = series.length;

  // Changing the metric or the period starts with nothing selected.
  React.useEffect(() => setActive(null), [series, metric]);
  const svgRef = React.useRef<SVGSVGElement>(null);

  if (n === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-1 rounded-2xl bg-surface-secondary/60 text-sm text-text-muted">
        <span className="font-medium text-text">Nothing in this period yet</span>
        Try a wider range above.
      </div>
    );
  }

  const values = series.map((p) => (metric === 'revenue' ? p.revenue : p.jobs));
  const max = Math.max(...values, 1) * 1.12;
  const x = (i: number) => (n === 1 ? W / 2 : PAD.left + (i / (n - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const points: Array<[number, number]> = values.map((v, i) => [x(i), y(v)]);
  const line = smoothPath(points);
  const floor = H - PAD.bottom;
  const area = `${line} L ${x(n - 1)} ${floor} L ${x(0)} ${floor} Z`;
  const fmt = (v: number) => (metric === 'revenue' ? currency(v) : number(v));

  const nearest =(clientX: number): number => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < n; i++) {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    }
    return best;
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((cur) => {
        const from = cur ?? (e.key === 'ArrowRight' ? -1 : n);
        const next = e.key === 'ArrowRight' ? Math.min(n - 1, from + 1) : Math.max(0, from - 1);
        return next;
      });
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  };

  const current = active !== null ? series[active] : null;
  const tickIdx = n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div className="relative">
      {/* The readout for the day under the pointer. Empty until someone points. */}
      <div className="mb-2 flex min-h-[2.5rem] justify-end">
        <div
          className={`rounded-xl border border-border/70 bg-surface px-3 py-1.5 text-right shadow-card transition-all duration-200 ${
            current ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
          }`}
          aria-live="polite"
        >
          <p className="text-[11px] text-text-muted">{current ? dateOnly(current.date) : ' '}</p>
          <p className="text-sm font-semibold tabular text-text">{current ? fmt(values[active ?? 0] ?? 0) : ' '}</p>
        </div>
      </div>

      <div className="relative" style={{ height: H }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl"
          role="img"
          aria-label={`${metric === 'revenue' ? 'Revenue' : 'Jobs'} by day. Use the arrow keys to read each day.`}
          tabIndex={0}
          onKeyDown={onKey}
          onPointerMove={(e) => setActive(nearest(e.clientX))}
          onPointerDown={(e) => setActive(nearest(e.clientX))}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
        >
          <defs>
            <linearGradient id={`trend-${metric}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--color-primary))" stopOpacity="0.32" />
              <stop offset="100%" stopColor="rgb(var(--color-primary))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={PAD.top + f * (H - PAD.top - PAD.bottom)}
              y2={PAD.top + f * (H - PAD.top - PAD.bottom)}
              stroke="rgb(var(--color-border))"
              strokeDasharray="2 6"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={area} fill={`url(#trend-${metric})`} className="animate-fade" />
          <path
            d={line}
            fill="none"
            stroke="rgb(var(--color-primary))"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            className="draw-line"
          />

          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top - 4}
              y2={floor}
              stroke="rgb(var(--color-text))"
              strokeOpacity="0.35"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Points are HTML so they stay round at any width, and are the only
            things that move while the crosshair follows the pointer. */}
        {points.map(([px, py], i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-primary shadow transition-transform duration-150 ${
              active === i ? 'scale-125 opacity-100' : n === 1 ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ left: `${(px / W) * 100}%`, top: `${(py / H) * 100}%` }}
          />
        ))}
      </div>

      <div className="relative mt-2 h-4 text-[11px] text-text-muted tabular" aria-hidden="true">
        {tickIdx.map((i, k) => (
          <span
            key={`${i}-${k}`}
            className="absolute top-0"
            style={{
              left: `${(x(i) / W) * 100}%`,
              transform: k === 0 ? 'none' : k === tickIdx.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {series[i] ? dateOnly(series[i].date) : ''}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{metric === 'revenue' ? 'Revenue by day' : 'Jobs by day'}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">{metric === 'revenue' ? 'Revenue' : 'Jobs'}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p, i) => (
            <tr key={p.date}>
              <td>{dateOnly(p.date)}</td>
              <td>{fmt(values[i] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A smooth curve through the points (Catmull-Rom converted to cubic segments). */
export function smoothPath(points: Array<[number, number]>): string {
  if (points.length === 0) return '';
  const [first] = points;
  if (points.length === 1 || !first) return `M${first?.[0] ?? 0},${first?.[1] ?? 0}`;
  let d = `M${first[0]},${first[1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}
