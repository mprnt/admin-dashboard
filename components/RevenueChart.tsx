'use client';

import React from 'react';
import type { SeriesPoint } from '@/lib/api';
import { currency, currencyCompact, dateOnly } from '@/lib/format';

/**
 * Revenue over time.
 *
 * Inline SVG rather than a charting library: this is one bar series, and a
 * dependency would cost more in bundle size than it saves in code. It also
 * means the bars inherit the theme tokens directly, so dark mode needs no
 * separate configuration.
 *
 * Accessibility: a chart that is only a picture is unreadable to a screen
 * reader, so the same data is also rendered as a real table, visually hidden.
 */
export function RevenueChart({ series, loading }: { series: SeriesPoint[]; loading?: boolean }) {
  const [active, setActive] = React.useState<number | null>(null);

  // The hovered bar is remembered by index, so a shorter series - switching to
  // one printer, or to a narrower period - would leave the index pointing past
  // the end and crash on read. Dropping it whenever the data changes is right
  // anyway: the bar under the cursor is no longer the one being pointed at.
  React.useEffect(() => setActive(null), [series]);

  if (loading) {
    return <div className="skeleton h-56 w-full" />;
  }

  if (series.length === 0) {
    return (
      <div className="h-56 flex flex-col items-center justify-center gap-1 text-sm text-text-muted rounded-xl bg-surface-secondary/60">
        <span className="font-medium text-text">No activity in this period</span>
        Try a wider range above.
      </div>
    );
  }

  const max = Math.max(...series.map((p) => p.revenue), 1);
  const total = series.reduce((sum, p) => sum + p.revenue, 0);
  const shown = active !== null && active < series.length ? active : null;

  // A single bucket (e.g. "today") shouldn't stretch across the full width.
  const barWidth = series.length === 1 ? '20%' : undefined;

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-3 min-h-[3.25rem]">
        <div>
          <p className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-text tabular leading-none">
            {currency(total)}
          </p>
          <p className="text-xs text-text-muted mt-1.5">Total for the period</p>
        </div>
        <div
          className={`text-right transition-opacity ${shown === null ? 'opacity-0' : 'opacity-100'}`}
          aria-hidden="true"
        >
          {shown !== null && (
            <>
              <p className="text-sm font-semibold text-accent tabular">
                {currency(series[shown].revenue)}
              </p>
              <p className="text-xs text-text-muted">
                {dateOnly(series[shown].date)} · {series[shown].jobs} jobs
                {series[shown].failed > 0 && (
                  <span className="text-error"> · {series[shown].failed} failed</span>
                )}
              </p>
            </>
          )}
        </div>
      </div>

      {/* The bars are decorative; the table below carries the data. */}
      <div className="relative h-44" aria-hidden="true">
        {/* Gridlines at 0, 50% and 100% of the peak. */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[max, max / 2, 0].map((v, i) => (
            <div key={i} className="relative border-t border-dashed border-border/80 first:border-solid first:border-transparent">
              <span className="absolute -top-2 right-0 bg-surface pl-1.5 text-[10px] text-text-muted tabular">
                {i === 2 ? '' : currencyCompact(v)}
              </span>
            </div>
          ))}
        </div>

        <div
          className="relative h-full flex items-end gap-[3px] sm:gap-1.5 pr-10"
          onMouseLeave={() => setActive(null)}
        >
          {series.map((point, i) => {
            const heightPct = Math.max((point.revenue / max) * 100, point.revenue > 0 ? 3 : 1);
            const isLast = i === series.length - 1;
            const on = active === i;
            return (
              <div
                key={point.date}
                className="flex-1 h-full flex items-end cursor-default"
                style={barWidth ? { maxWidth: barWidth } : undefined}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
              >
                <div
                  className={`relative w-full rounded-t-[5px] rounded-b-[2px] transition-[background-color,opacity] duration-150 ${
                    on
                      ? 'bg-accent'
                      : active !== null
                        ? 'bg-accent/25'
                        : isLast
                          ? 'bg-accent/80'
                          : 'bg-accent/45'
                  }`}
                  style={{ height: `${heightPct}%` }}
                >
                  {point.failed > 0 && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-error" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between mt-2.5 pr-10 text-[11px] text-text-muted" aria-hidden="true">
        <span>{dateOnly(series[0].date)}</span>
        {series.length > 1 && <span>{dateOnly(series[series.length - 1].date)}</span>}
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm bg-accent/45" />
          Revenue
        </span>
        {series.some((p) => p.failed > 0) && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-error" />
            Day with failed jobs
          </span>
        )}
        <span className="tabular ml-auto">Peak {currencyCompact(max)}</span>
      </div>

      <table className="sr-only">
        <caption>Revenue and job counts by date</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Revenue</th>
            <th scope="col">Jobs</th>
            <th scope="col">Completed</th>
            <th scope="col">Failed</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.date}>
              <th scope="row">{dateOnly(p.date)}</th>
              <td>{currency(p.revenue)}</td>
              <td>{p.jobs}</td>
              <td>{p.completed}</td>
              <td>{p.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
