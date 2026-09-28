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

  if (loading) {
    return <div className="skeleton h-48 w-full" />;
  }

  if (series.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-text-muted">
        No activity in this period
      </div>
    );
  }

  const max = Math.max(...series.map((p) => p.revenue), 1);
  const total = series.reduce((sum, p) => sum + p.revenue, 0);

  // A single bucket (e.g. "today") shouldn't stretch across the full width.
  const barWidth = series.length === 1 ? '20%' : undefined;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4 gap-2">
        <div>
          <p className="text-2xl sm:text-3xl font-bold text-text tabular">{currency(total)}</p>
          <p className="text-xs text-text-muted">Total for the period</p>
        </div>
        {active !== null && (
          <div className="text-right" aria-hidden="true">
            <p className="text-sm font-bold text-accent tabular">
              {currency(series[active].revenue)}
            </p>
            <p className="text-xs text-text-muted">{dateOnly(series[active].date)}</p>
          </div>
        )}
      </div>

      {/* The bars are decorative; the table below carries the data. */}
      <div
        className="flex items-end gap-1 sm:gap-1.5 h-40"
        aria-hidden="true"
        onMouseLeave={() => setActive(null)}
      >
        {series.map((point, i) => {
          const heightPct = Math.max((point.revenue / max) * 100, point.revenue > 0 ? 4 : 1.5);
          return (
            <div
              key={point.date}
              className="flex-1 h-full flex items-end"
              style={barWidth ? { maxWidth: barWidth } : undefined}
              onMouseEnter={() => setActive(i)}
            >
              <div
                className={`w-full rounded-t transition-colors ${
                  active === i ? 'bg-primary' : 'bg-primary/60'
                } ${point.failed > 0 ? 'ring-1 ring-error/40' : ''}`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-2 text-[11px] text-text-muted" aria-hidden="true">
        <span>{dateOnly(series[0].date)}</span>
        {series.length > 1 && <span>{dateOnly(series[series.length - 1].date)}</span>}
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm bg-primary/60" />
          Revenue
        </span>
        <span className="tabular">Peak {currencyCompact(max)}</span>
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
