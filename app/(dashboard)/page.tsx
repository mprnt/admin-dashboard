'use client';

import React from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/useApi';
import { useProfile } from '@/lib/useProfile';
import {
  buildQuery,
  type Comparison,
  type Period,
  type Range,
  type Summary,
  type SeriesPoint,
} from '@/lib/api';
import { currency, number, duration, relativeAge } from '@/lib/format';
import {
  Card,
  CardHeader,
  Stat,
  StatStrip,
  StatusPill,
  ErrorState,
  EmptyState,
  PageHeader,
} from '@/components/ui';
import { PeriodFilter } from '@/components/PeriodFilter';
import { RevenueChart } from '@/components/RevenueChart';
import { Icon } from '@/components/Icon';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import type { AttentionRow, PrinterRow } from '@/lib/api';

export default function OverviewPage() {
  const [period, setPeriod] = React.useState<Period>('month');
  const isSuper = useProfile()?.role === 'super_admin';

  const summary = useApi<{ range: Range; summary: Summary; comparison: Comparison | null }>(
    `/reports/summary${buildQuery({ period })}`
  );
  const series = useApi<{ range: Range; bucket: Period; series: SeriesPoint[] }>(
    `/reports/series${buildQuery({ period })}`
  );
  const attention = useApi<{ count: number; jobs: AttentionRow[] }>('/attention');
  const printers = useApi<{ count: number; printers: PrinterRow[] }>('/printers');

  const s = summary.data?.summary;
  const cmp = summary.data?.comparison ?? null;
  const trendLabel = TREND_LABEL[period];
  const offline = printers.data?.printers.filter((p) => p.status === 'offline').length ?? 0;
  const needsAttention = attention.data?.count ?? 0;

  const greeting = useGreeting();
  const allClear =
    !attention.loading && !printers.loading && !attention.error && !printers.error &&
    needsAttention === 0 && offline === 0;
  const lowPaper = printers.data?.printers.filter(
    (p) => p.status !== 'offline' && p.paperLevel !== null && p.paperLevel < 20
  ).length ?? 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow={greeting.date ? `${greeting.hello} · ${greeting.date}` : '\u00a0'}
        title="Overview"
        subtitle="Here’s how your QR points are doing."
        actions={
          <>
            <OrgSwitcher />
            <PeriodFilter
              value={period}
              onChange={setPeriod}
              timezone={summary.data?.range.timezone}
            />
          </>
        }
      />

      {/* Anything needing a human comes before the vanity metrics. When there
          is nothing, say so: silence reads as "still loading" or "broken". */}
      {(needsAttention > 0 || offline > 0 || lowPaper > 0) && (
        <section aria-labelledby="needs-you">
          <h2 id="needs-you" className="eyebrow mb-2.5">
            Needs you
          </h2>
          <Card className="divide-y divide-border/70 overflow-hidden">
            {needsAttention > 0 && (
              <AlertRow
                href="/attention"
                tone="warning"
                icon="alert"
                title={`${needsAttention} paid ${needsAttention === 1 ? 'job' : 'jobs'} not printed`}
                body={
                  isSuper
                    ? 'Customers have paid. Review before they ask for a refund.'
                    : 'Customers have paid. For refunds, contact your MPrnt administrator.'
                }
              />
            )}
            {offline > 0 && (
              <AlertRow
                href="/printers"
                tone="error"
                icon="printer"
                title={`${offline} ${offline === 1 ? 'printer' : 'printers'} offline`}
                body="Jobs cannot be printed while a QR point has no printer online."
              />
            )}
            {lowPaper > 0 && (
              <AlertRow
                href="/printers"
                tone="info"
                icon="inbox"
                title={`Paper running low on ${lowPaper} ${lowPaper === 1 ? 'printer' : 'printers'}`}
                body="Below 20%. Refill before the next rush."
              />
            )}
          </Card>
        </section>
      )}

      {allClear && (
        <div className="flex items-center gap-3 rounded-2xl bg-success/10 px-4 py-3 text-sm">
          <span className="w-7 h-7 rounded-full bg-success/15 text-success flex items-center justify-center flex-shrink-0">
            <Icon name="check" className="w-4 h-4" />
          </span>
          <p className="text-text">
            <span className="font-semibold">All clear.</span>{' '}
            <span className="text-text-muted">Every paid job has printed and every printer is online.</span>
          </p>
        </div>
      )}

      {summary.error ? (
        <Card>
          <ErrorState message={summary.error} onRetry={summary.reload} />
        </Card>
      ) : (
        <StatStrip>
          <Stat
            bare
            label="Revenue"
            value={currency(s?.revenue ?? 0)}
            hint={s ? `${number(s.paidJobs)} paid jobs` : undefined}
            icon={<Icon name="chart" className="w-3.5 h-3.5" />}
            loading={summary.loading}
            trend={
              cmp
                ? {
                    pct: cmp.change.revenuePct,
                    hasCurrent: cmp.current.revenue > 0,
                    label: trendLabel,
                  }
                : undefined
            }
          />
          <Stat
            bare
            label="Pages printed"
            value={number(s?.pagesPrinted ?? 0)}
            hint={s ? `${number(s.colorPages)} colour · ${number(s.bwPages)} b/w` : undefined}
            icon={<Icon name="printer" className="w-3.5 h-3.5" />}
            loading={summary.loading}
          />
          <Stat
            bare
            label="Completed"
            value={number(s?.completedJobs ?? 0)}
            hint={
              s?.fulfilmentRate !== null && s?.fulfilmentRate !== undefined
                ? `${s.fulfilmentRate}% of paid jobs`
                : undefined
            }
            tone={s && s.fulfilmentRate !== null && s.fulfilmentRate < 90 ? 'warning' : 'default'}
            icon={<Icon name="check" className="w-3.5 h-3.5" />}
            loading={summary.loading}
            trend={
              cmp
                ? {
                    pct: pctChange(cmp.current.completedJobs, cmp.previous.completedJobs),
                    hasCurrent: cmp.current.completedJobs > 0,
                    label: trendLabel,
                  }
                : undefined
            }
          />
          <Stat
            bare
            label="Failed"
            value={number(s?.failedJobs ?? 0)}
            hint={s ? `avg print ${duration(s.avgPrintSeconds)}` : undefined}
            tone={s && s.failedJobs > 0 ? 'error' : 'default'}
            icon={<Icon name="alert" className="w-3.5 h-3.5" />}
            loading={summary.loading}
            trend={
              cmp
                ? {
                    pct: pctChange(cmp.current.failedJobs, cmp.previous.failedJobs),
                    hasCurrent: cmp.current.failedJobs > 0,
                    // More failures is worse, so an increase reads red.
                    invert: true,
                    label: trendLabel,
                  }
                : undefined
            }
          />
        </StatStrip>
      )}

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Revenue" subtitle={rangeLabel(summary.data?.range)} />
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            {series.error ? (
              <ErrorState message={series.error} onRetry={series.reload} />
            ) : (
              <RevenueChart series={series.data?.series ?? []} loading={series.loading} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Activity"
            subtitle="From visit to printed page"
            action={<ViewAll href="/sessions" label="Sessions" />}
          />
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            {summary.loading ? (
              <div className="space-y-4 pt-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-8" />
                ))}
              </div>
            ) : (
              <>
                {/* A funnel: each bar is relative to sessions started, so the
                    drop-off between steps is visible at a glance. */}
                <dl className="space-y-3.5">
                  <FunnelRow label="Sessions started" value={s?.sessions ?? 0} of={s?.sessions ?? 0} />
                  <FunnelRow label="Jobs created" value={s?.totalJobs ?? 0} of={s?.sessions ?? 0} />
                  <FunnelRow label="Paid" value={s?.paidJobs ?? 0} of={s?.sessions ?? 0} />
                  <FunnelRow label="Completed" value={s?.completedJobs ?? 0} of={s?.sessions ?? 0} />
                </dl>
                <dl className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-border/70">
                  <div>
                    <dt className="text-xs text-text-muted">In progress</dt>
                    <dd className="text-lg font-semibold text-text tabular mt-0.5">
                      {number(s?.inProgressJobs ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Average order</dt>
                    <dd className="text-lg font-semibold text-text tabular mt-0.5">
                      {currency(s?.averageOrderValue ?? 0)}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Printers"
          subtitle={
            printers.data
              ? `${printers.data.count - offline} of ${printers.data.count} online`
              : 'Loading…'
          }
          action={<ViewAll href="/printers" label="Printers" />}
        />
        {printers.loading ? (
          <div className="px-4 pb-4 sm:px-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
        ) : printers.data?.printers.length ? (
          <ul className="px-4 pb-4 sm:px-5 sm:pb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {printers.data.printers.slice(0, 8).map((p) => (
              <li
                key={p.printerId}
                className="rounded-xl border border-border/70 bg-surface-secondary/60 p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{p.name}</p>
                    <p className="text-xs text-text-muted truncate">
                      {p.kiosk.code} · {p.kiosk.name}
                    </p>
                  </div>
                  <StatusPill status={p.status} />
                </div>
                {p.status === 'offline' ? (
                  // A paper level from before it went quiet would look live.
                  <p className="text-xs text-error mt-3">
                    {p.secondsSinceHeartbeat !== null
                      ? `Last seen ${relativeAge(p.secondsSinceHeartbeat)}`
                      : 'Never connected'}
                  </p>
                ) : (
                  <Meter label="Paper" value={p.paperLevel} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No printers yet"
            message="Enroll a Raspberry Pi to start printing."
            icon={<Icon name="printer" className="w-6 h-6" />}
          />
        )}
      </Card>
    </div>
  );
}

const ALERT_TONE = {
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  info: 'bg-info/10 text-info',
} as const;

function AlertRow({
  href,
  tone,
  icon,
  title,
  body,
}: {
  href: string;
  tone: keyof typeof ALERT_TONE;
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3.5 px-4 py-3.5 sm:px-5 hover:bg-surface-secondary/70 transition-colors"
    >
      <span
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ALERT_TONE[tone]}`}
      >
        <Icon name={icon} className="w-[18px] h-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text">{title}</span>
        <span className="block text-xs text-text-muted mt-0.5">{body}</span>
      </span>
      <Icon
        name="chevronRight"
        className="w-4 h-4 text-text-muted flex-shrink-0 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline min-h-[32px]"
    >
      View all<span className="sr-only"> {label.toLowerCase()}</span>
      <Icon name="arrowRight" className="w-3.5 h-3.5" />
    </Link>
  );
}

function FunnelRow({ label, value, of }: { label: string; value: number; of: number }) {
  const pct = of > 0 ? Math.min(100, (value / of) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[13px] text-text-muted">{label}</dt>
        <dd className="text-sm font-semibold text-text tabular">{number(value)}</dd>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-surface-sunken overflow-hidden" aria-hidden="true">
        <div
          className="h-full rounded-full bg-accent/70 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return <p className="text-xs text-text-muted mt-3">{label} level not reported</p>;
  }
  const low = value < 20;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs">
        <span className="text-text-muted">{label}</span>
        <span className={`tabular font-medium ${low ? 'text-warning' : 'text-text'}`}>
          {value}%{low && ' · low'}
        </span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-surface-sunken overflow-hidden" aria-hidden="true">
        <div
          className={`h-full rounded-full ${low ? 'bg-warning' : 'bg-accent/60'}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Time-of-day greeting and today's date. Computed after mount: the server
 * does not know the viewer's clock, and rendering it there would mismatch on
 * hydration.
 */
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

function rangeLabel(range?: Range): string | undefined {
  if (!range) return undefined;
  return `${range.from} to ${range.to}`;
}

/**
 * The comparison window is like-for-like: this period so far against the same
 * span of the previous one. The wording says so, because "vs last month" would
 * suggest the whole of last month.
 */
const TREND_LABEL: Record<Period, string> = {
  day: 'vs this time yesterday',
  week: 'vs this point last week',
  month: 'vs this point last month',
  year: 'vs this point last year',
};

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
