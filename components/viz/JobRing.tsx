'use client';

import React from 'react';
import { useMounted } from './motion';
import { number } from '@/lib/format';

/**
 * Where the period's paid jobs ended up, as one ring. Hover or tap a segment to
 * see its share in the centre. The legend carries the same figures, so colour is
 * never the only way to read it.
 */
export interface RingSegment {
  key: string;
  label: string;
  value: number;
  /** A CSS colour, read from the theme tokens. */
  color: string;
}

const R = 58;
const C = 2 * Math.PI * R;
const GAP = 1.5; // degrees-ish gap between segments, in the ring's own units

export function JobRing({ segments, centreLabel }: { segments: RingSegment[]; centreLabel: string }) {
  const mounted = useMounted(120);
  const [active, setActive] = React.useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  const arcs = React.useMemo(() => {
    let offset = 0;
    return segments.map((s) => {
      const len = total > 0 ? (s.value / total) * C : 0;
      const arc = { ...s, len: Math.max(0, len - GAP), offset };
      offset += len;
      return arc;
    });
  }, [segments, total]);

  const focus = active ? segments.find((s) => s.key === active) : null;
  const centreValue = focus ? number(focus.value) : number(total);
  const centreSub = focus
    ? `${focus.label} · ${total > 0 ? Math.round((focus.value / total) * 100) : 0}%`
    : centreLabel;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-[168px] w-[168px]">
        <svg viewBox="0 0 150 150" className="h-full w-full -rotate-90" role="img" aria-label={`${centreLabel}: ${number(total)}`}>
          <circle cx="75" cy="75" r={R} fill="none" stroke="rgb(var(--color-surface-sunken))" strokeWidth="14" />
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx="75"
              cy="75"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={active === a.key ? 18 : 14}
              strokeLinecap="round"
              strokeDasharray={`${mounted ? a.len : 0} ${C}`}
              strokeDashoffset={-a.offset}
              className="cursor-pointer transition-[stroke-dasharray,stroke-width,opacity] duration-700 ease-out"
              opacity={active && active !== a.key ? 0.35 : 1}
              onMouseEnter={() => setActive(a.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(a.key)}
              onBlur={() => setActive(null)}
              onClick={() => setActive((cur) => (cur === a.key ? null : a.key))}
              tabIndex={0}
              aria-label={`${a.label}: ${number(a.value)}`}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[26px] font-semibold leading-none tracking-tight text-text tabular">{centreValue}</span>
          <span className="mt-1.5 max-w-[9rem] text-[11px] leading-tight text-text-muted">{centreSub}</span>
        </div>
      </div>

      <ul className="grid w-full gap-1.5">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li key={s.key}>
              <button
                type="button"
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(s.key)}
                onBlur={() => setActive(null)}
                className={`flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm transition-colors ${
                  active === s.key ? 'bg-text/5' : ''
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <span className="flex-1 text-text-muted">{s.label}</span>
                <span className="font-semibold tabular text-text">{number(s.value)}</span>
                <span className="w-9 text-right text-xs tabular text-text-muted">{pct}%</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
