'use client';

import React from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/useApi';
import {
  buildQuery,
  type AttentionRow,
  type Comparison,
  type Period,
  type PrinterRow,
  type Range,
  type SeriesPoint,
  type Summary,
} from '@/lib/api';
import { currency, number, duration, relativeAge } from '@/lib/format';
import { Card, CardHeader, ErrorState, EmptyState, PageHeader, Trend } from '@/components/ui';
import { PeriodFilter } from '@/components/PeriodFilter';
import { RevenueSplitCard } from '@/components/RevenueSplitCard';
import { BillingCard } from '@/components/BillingCard';
import { Icon } from '@/components/Icon';
import { AreaTrend, type TrendMetric } from '@/components/viz/AreaTrend';
import { DayGrid } from '@/components/viz/DayGrid';
import { HighlightStrip, type Highlight } from '@/components/viz/HighlightStrip';
import { JobRing } from '@/components/viz/JobRing';
import { PaperTank } from '@/components/viz/PaperTank';

/**
 * The shop owner's first screen. It answers three questions in order: is money
 * coming in, is anything needing me, and are my printers working. Everything
 * else is a click away. Plain words and one clear action per item, because this
 * is read by someone at a counter between customers.
 */
export default function OverviewPage() {
  const [period, setPeriod] = React.useState<Period>('month');
  const [metric, setMetric] = React.useState<TrendMetric>('revenue');

  const summary = useApi<{ range: Range; summary: Summary; comparison: Comparison | null }>(
    `/reports/summary${buildQuery({ period })}`
  );
  // One daily series feeds both the trend and the calendar.
  const series = useApi<{ range: Range; bucket: Period; series: SeriesPoint[] }>(
    `/reports/series${buildQuery({ period, bucket: 'day' })}`
  );
  const attention = useApi<{ count: number; jobs: AttentionRow[] }>('/attention');
  const printers = useApi<{ count: number; printers: PrinterRow[] }>('/printers');

  const s = summary.data?.summary;
  const cmp = summary.data?.comparison ?? null;
  const offline = printers.data?.printers.filter((p) => p.status === 'offline').length ?? 0;
  const needsAttention = attention.data?.count ?? 0;
  const lowPaper =
    printers.data?.printers.filter((p) => p.status !== 'offline' && p.paperLevel !== null && p.paperLevel < 20).length ?? 0;
  const allClear =
    !attention.loading && !printers.loading && !attention.error && !printers.error &&
    needsAttention === 0 && offline === 0 && lowPaper === 0;

  const greeting = useGreeting();
  const paidJobs = s?.paidJobs ?? 0;
  const ring = [
    { key: 'done', label: 'Printed', value: s?.completedJobs ?? 0, color: 'rgb(var(--color-primary))' },
    { key: 'busy', label: 'Printing now', value: s?.inProgressJobs ?? 0, color: 'rgb(var(--color-info))' },
    { key: 'waiting', label: 'Paid, waiting to print', value: Math.max(0, paidJobs - (s?.completedJobs ?? 0) - (s?.inProgressJobs ?? 0) - (s?.failedJobs ?? 0)), color: 'rgb(var(--color-warning))' },
    { key: 'failed', label: 'Could not print', value: s?.failedJobs ?? 0, color: 'rgb(var(--color-error))' },
  ];

  // The three cards in the strip at the top: money, printing, printers.
  const highlights: Highlight[] = [
    {
      key: 'money',
      eyebrow: `Money this ${PERIOD_WORD[period]}`,
      figure: currency(s?.revenue ?? 0),
      line: `${number(paidJobs)} paid ${paidJobs === 1 ? 'job' : 'jobs'}`,
      href: '/sessions',
      action: 'See print history',
      featured: true,
    },
    {
      key: 'printed',
      eyebrow: 'Printed',
      figure: number(s?.completedJobs ?? 0),
      line: s?.fulfilmentRate == null ? 'No paid jobs yet' : `${s.fulfilmentRate}% of paid jobs printed`,
      href: '/sessions',
      action: 'See what printed',
    },
    {
      key: 'printers',
      eyebrow: 'Printers working',
      figure: printers.data ? `${printers.data.count - offline} of ${printers.data.count}` : '…',
      line: offline > 0 ? `${offline} offline right now` : 'All printers online',
      href: '/printers',
      action: 'Manage printers',
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-7">
      <PageHeader
        eyebrow={greeting.date ? `${greeting.hello} · ${greeting.date}` : ' '}
        title="Overview"
        subtitle="Money coming in, anything that needs you, and your printers."
        actions={<PeriodFilter value={period} onChange={setPeriod} timezone={summary.data?.range.timezone} />}
      />

      {/* Anything needing a person comes first. When there is nothing, say so plainly. */}
      {!allClear && (needsAttention > 0 || offline > 0 || lowPaper > 0) && (
        <section aria-labelledby="needs-you" className="rise" style={{ ['--i' as string]: 0 }}>
          <h2 id="needs-you" className="eyebrow mb-2.5">Needs you</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {needsAttention > 0 && (
              <NeedsRow href="/attention" tone="warning" icon="alert" title={`${needsAttention} ${needsAttention === 1 ? 'job' : 'jobs'} paid but not printed`} body="Tap to see them. Refunds are done by MPRNT." />
            )}
            {offline > 0 && (
              <NeedsRow href="/printers" tone="error" icon="printer" title={`${offline} ${offline === 1 ? 'printer is' : 'printers are'} offline`} body="Customers cannot print on an offline printer." />
            )}
            {lowPaper > 0 && (
              <NeedsRow href="/printers" tone="info" icon="inbox" title={`Paper is low on ${lowPaper} ${lowPaper === 1 ? 'printer' : 'printers'}`} body="Refill it before the next rush." />
            )}
          </div>
        </section>
      )}

      {allClear && (
        <div className="rise flex items-center gap-3 rounded-2xl bg-success/10 px-4 py-3.5 text-sm" style={{ ['--i' as string]: 0 }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            <Icon name="check" className="h-4 w-4" />
          </span>
          <p className="text-text">
            <span className="font-semibold">All good.</span>{' '}
            <span className="text-text-muted">Every paid job has printed and every printer is working.</span>
          </p>
        </div>
      )}

      {s && <HighlightStrip items={highlights} />}

      {summary.error ? (
        <Card>
          <ErrorState message={summary.error} onRetry={summary.reload} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
          {/* The main figure and its chart. */}
          <Card className="rise lg:col-span-8 p-4 sm:p-6" as="section" style={{ ['--i' as string]: 1 }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-text">
                  {metric === 'revenue' ? 'Money' : 'Paid jobs'}, day by day
                </h2>
                <p className="mt-0.5 text-sm text-text-muted">Tap the chart to see any day.</p>
                {cmp && (
                  <div className="mt-2">
                    <Trend
                      pct={metric === 'revenue' ? cmp.change.revenuePct : pctChange(cmp.current.paidJobs, cmp.previous.paidJobs)}
                      hasCurrent={metric === 'revenue' ? cmp.current.revenue > 0 : cmp.current.paidJobs > 0}
                      label={TREND_LABEL[period]}
                    />
                  </div>
                )}
              </div>
              <div role="group" aria-label="Show" className="flex rounded-full bg-surface-sunken p-1">
                {(['revenue', 'jobs'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetric(m)}
                    aria-pressed={metric === m}
                    className={`min-h-[40px] rounded-full px-4 text-sm font-medium transition-colors ${
                      metric === m ? 'bg-surface text-text shadow-card' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {m === 'revenue' ? 'Money' : 'Jobs'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              {series.error ? (
                <ErrorState message={series.error} onRetry={series.reload} />
              ) : series.loading ? (
                <div className="skeleton h-56 w-full" />
              ) : (
                <AreaTrend series={series.data?.series ?? []} metric={metric} />
              )}
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-border/70 pt-5 sm:grid-cols-3">
              <Fact label="Pages printed" value={number(s?.pagesPrinted ?? 0)} note={`${number(s?.colorPages ?? 0)} colour, ${number(s?.bwPages ?? 0)} black & white`} />
              <Fact label="Average bill" value={currency(s?.averageOrderValue ?? 0)} note="Per paid job" />
              <Fact label="Usual print time" value={duration(s?.avgPrintSeconds ?? null)} note="From start to finish" />
            </dl>
          </Card>

          {/* How the paid jobs ended up. */}
          <Card className="rise lg:col-span-4 p-4 sm:p-6" as="section" style={{ ['--i' as string]: 2 }}>
            <h2 className="text-[15px] font-semibold text-text">How paid jobs ended</h2>
            <p className="mt-0.5 text-xs text-text-muted">Tap a row to see its share.</p>
            <div className="mt-5">
              {summary.loading ? (
                <div className="skeleton mx-auto h-[168px] w-[168px] rounded-full" />
              ) : (
                <JobRing segments={ring} centreLabel="paid jobs" />
              )}
            </div>
            {s && s.fulfilmentRate !== null && (
              <p className="mt-4 border-t border-border/70 pt-4 text-sm text-text-muted">
                <span className="font-semibold text-text">{s.fulfilmentRate}%</span> of paid jobs were printed.
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Printers, as plain tanks: the paper inside is the reading. */}
      <Card className="rise p-4 sm:p-6" as="section" style={{ ['--i' as string]: 3 }}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-text">Your printers</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              {printers.data ? `${printers.data.count - offline} of ${printers.data.count} working` : 'Checking…'}
            </p>
          </div>
          <Link href="/printers" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-accent hover:underline">
            Manage printers <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </Link>
        </div>
        {printers.loading ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-40" />)}
          </div>
        ) : printers.data?.printers.length ? (
          <ul className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {printers.data.printers.slice(0, 8).map((p) => <PrinterTile key={p.printerId} printer={p} />)}
          </ul>
        ) : (
          <EmptyState title="No printers yet" message="MPRNT sets up your printers. Ask us to add one." icon={<Icon name="printer" className="h-6 w-6" />} />
        )}
      </Card>

      <Card className="rise p-4 sm:p-6" as="section" style={{ ['--i' as string]: 4 }}>
        <h2 className="text-[15px] font-semibold text-text">Busiest days</h2>
        <p className="mt-0.5 mb-5 text-sm text-text-muted">Each square is a day. Darker means more money came in.</p>
        {series.loading ? <div className="skeleton h-32" /> : <DayGrid series={series.data?.series ?? []} />}
      </Card>

      <RevenueSplitCard period={period} />
      <BillingCard />
    </div>
  );
}

const PERIOD_WORD: Record<Period, string> = { day: 'day', week: 'week', month: 'month', year: 'year' };

/** One printer, in plain words: working or not, and how much paper is left. */
function PrinterTile({ printer: p }: { printer: PrinterRow }) {
  const offline = p.status === 'offline';
  return (
    <li className="rounded-2xl border border-border/70 bg-surface-secondary/50 p-4 transition-colors hover:border-accent/40">
      <Link href="/printers" className="flex items-start gap-4 min-h-[44px]">
        <PaperTank value={offline ? null : p.paperLevel} live={!offline} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text">{p.name}</span>
          <span className="block truncate text-xs text-text-muted">{p.kiosk.name}</span>
          <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium ${offline ? 'text-error' : 'text-success'}`}>
            <span className={`h-2 w-2 rounded-full ${offline ? 'bg-error' : 'bg-success live-dot'}`} aria-hidden="true" />
            {offline
              ? p.secondsSinceHeartbeat !== null
                ? `Offline · last seen ${relativeAge(p.secondsSinceHeartbeat)}`
                : 'Offline · never connected'
              : 'Working'}
          </span>
          {!offline && p.paperLevel !== null && p.paperLevel < 20 && (
            <span className="mt-1 block text-xs font-medium text-warning">Paper low</span>
          )}
        </span>
      </Link>
    </li>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular text-text">{value}</dd>
      <dd className="text-xs text-text-muted">{note}</dd>
    </div>
  );
}

const TONE = {
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  info: 'bg-info/10 text-info',
} as const;

function NeedsRow({
  href,
  tone,
  icon,
  title,
  body,
}: {
  href: string;
  tone: keyof typeof TONE;
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="group flex min-h-[64px] items-center gap-3.5 rounded-2xl border border-border/70 bg-surface px-4 py-3 shadow-card transition-colors hover:border-accent/40">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE[tone]}`}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text">{title}</span>
        <span className="mt-0.5 block text-xs text-text-muted">{body}</span>
      </span>
      <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Time-of-day greeting. Computed after mount, so the server's clock never leaks into the markup. */
function useGreeting(): { hello: string; date: string } {
  const [value, setValue] = React.useState({ hello: '', date: '' });
  React.useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    setValue({
      hello: h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening',
      date: now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
    });
  }, []);
  return value;
}

/** Like for like: this point in the period against the same point in the last one. */
const TREND_LABEL: Record<Period, string> = {
  day: 'compared with this time yesterday',
  week: 'compared with the same point last week',
  month: 'compared with the same point last month',
  year: 'compared with the same point last year',
};

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
