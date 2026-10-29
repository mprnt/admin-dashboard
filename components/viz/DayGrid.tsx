'use client';

import React from 'react';
import type { SeriesPoint } from '@/lib/api';
import { currency, number } from '@/lib/format';

/**
 * Every day of the period as one cell, shaded by how much was collected. Weeks
 * run across, weekdays down, like a wall calendar, so a dead Sunday or a busy
 * Saturday is visible without reading a number. Each cell names its day on
 * hover, focus or tap.
 */
const LEVELS = [
  'bg-surface-sunken',
  'bg-primary/20',
  'bg-primary/40',
  'bg-primary/65',
  'bg-primary',
] as const;

const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

function parseDay(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DayGrid({ series }: { series: SeriesPoint[] }) {
  const [hover, setHover] = React.useState<string | null>(null);

  const cells = React.useMemo(() => {
    if (series.length === 0) return null;
    const byDay = new Map(series.map((p) => [p.date.slice(0, 10), p]));
    const first = parseDay(series[0]!.date.slice(0, 10));
    const last = parseDay(series[series.length - 1]!.date.slice(0, 10));
    // Start on the Monday of the first week so the columns line up by weekday.
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const days: Array<{ ymd: string; point: SeriesPoint | null; inRange: boolean }> = [];
    for (const d = new Date(start); d <= last || days.length % 7 !== 0; d.setDate(d.getDate() + 1)) {
      const ymd = toYmd(d);
      days.push({ ymd, point: byDay.get(ymd) ?? null, inRange: d >= first && d <= last });
      if (days.length > 400) break;
    }
    const max = Math.max(...series.map((p) => p.revenue), 1);
    return { days, max };
  }, [series]);

  if (!cells) {
    return <div className="h-32 rounded-2xl bg-surface-secondary/60" />;
  }

  const weeks = cells.days.length / 7;
  const shown = hover ? cells.days.find((d) => d.ymd === hover) : null;

  const level = (rev: number) => {
    if (rev <= 0) return 0;
    const f = rev / cells.max;
    if (f < 0.25) return 1;
    if (f < 0.5) return 2;
    if (f < 0.75) return 3;
    return 4;
  };

  return (
    <div>
      <div className="mb-3 flex min-h-[2.75rem] items-end justify-between gap-3">
        <p className="text-sm text-text-muted">
          {shown ? (
            <span className="text-text">
              <span className="font-semibold">
                {parseDay(shown.ymd).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              {' · '}
              {shown.point
                ? `${currency(shown.point.revenue)} from ${number(shown.point.jobs)} ${shown.point.jobs === 1 ? 'job' : 'jobs'}`
                : 'No sales'}
            </span>
          ) : (
            'Tap a day to see what it brought in.'
          )}
        </p>
        <div className="flex shrink-0 items-center gap-1 text-[10px] text-text-muted" aria-hidden="true">
          <span>less</span>
          {LEVELS.map((c) => (
            <span key={c} className={`h-2.5 w-2.5 rounded-[3px] ${c}`} />
          ))}
          <span>more</span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <div className="grid shrink-0 grid-rows-7 gap-[3px] pt-0 text-[10px] leading-none text-text-muted" aria-hidden="true">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="flex h-[18px] items-center sm:h-5">
              {w}
            </span>
          ))}
        </div>
        <div
          className="grid grid-flow-col grid-rows-7 gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
          role="list"
          aria-label="Revenue by day"
        >
          {cells.days.map((d) => {
            const lv = d.inRange && d.point ? level(d.point.revenue) : 0;
            return (
              <button
                key={d.ymd}
                type="button"
                role="listitem"
                disabled={!d.inRange}
                aria-label={
                  d.inRange
                    ? `${d.ymd}: ${d.point ? currency(d.point.revenue) : 'no sales'}`
                    : undefined
                }
                onMouseEnter={() => setHover(d.ymd)}
                onFocus={() => setHover(d.ymd)}
                onClick={() => setHover(d.ymd)}
                onMouseLeave={() => setHover(null)}
                className={`h-[18px] w-[18px] rounded-[4px] sm:h-5 sm:w-5 ${
                  d.inRange ? LEVELS[lv] : 'bg-transparent'
                } ${hover === d.ymd ? 'ring-2 ring-inset ring-accent/70' : ''} ${
                  d.inRange ? 'cursor-pointer' : 'pointer-events-none'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
