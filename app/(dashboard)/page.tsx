'use client';

import React from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/useApi';
import {
  buildQuery,
  type Comparison,
  type Period,
  type Range,
  type Summary,
  type SeriesPoint,
} from '@/lib/api';
import { currency, number, duration } from '@/lib/format';
import { Card, CardHeader, Stat, ErrorState, EmptyState } from '@/components/ui';
import { PeriodFilter } from '@/components/PeriodFilter';
import { RevenueChart } from '@/components/RevenueChart';
import { Icon } from '@/components/Icon';
import type { AttentionRow, PrinterRow } from '@/lib/api';

export default function OverviewPage() {
  const [period, setPeriod] = React.useState<Period>('month');

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

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text">Overview</h1>
          <p className="text-sm text-text-muted">How your kiosks are doing</p>
        </div>
        <PeriodFilter
          value={period}
          onChange={setPeriod}
          timezone={summary.data?.range.timezone}
        />
      </div>

      {/* Anything needing a human is surfaced before the vanity metrics. */}
      {(needsAttention > 0 || offline > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {needsAttention > 0 && (
            <Link href="/attention" className="block">
              <Card className="p-4 border-warning/40 bg-warning/5 hover:border-warning transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-warning/15 text-warning flex items-center justify-center flex-shrink-0">
                    <Icon name="alert" className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-text">
                      {needsAttention} paid {needsAttention === 1 ? 'job' : 'jobs'} not printed
                    </p>
                    <p className="text-xs text-text-muted">
                      Customers have paid. Review before they ask for a refund.
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          )}

          {offline > 0 && (
            <Link href="/printers" className="block">
              <Card className="p-4 border-error/40 bg-error/5 hover:border-error transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-error/15 text-error flex items-center justify-center flex-shrink-0">
                    <Icon name="printer" className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-text">
                      {offline} {offline === 1 ? 'printer' : 'printers'} offline
                    </p>
                    <p className="text-xs text-text-muted">
                      Jobs cannot be printed while a kiosk has no printer online.
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          )}
        </div>
      )}

      {summary.error ? (
        <Card>
          <ErrorState message={summary.error} onRetry={summary.reload} />
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Stat
            label="Revenue"
            value={currency(s?.revenue ?? 0)}
            hint={s ? `${number(s.paidJobs)} paid jobs` : undefined}
            icon={<Icon name="chart" className="w-4 h-4" />}
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
            label="Pages printed"
            value={number(s?.pagesPrinted ?? 0)}
            hint={s ? `${number(s.colorPages)} colour · ${number(s.bwPages)} b/w` : undefined}
            icon={<Icon name="printer" className="w-4 h-4" />}
            loading={summary.loading}
          />
          <Stat
            label="Completed"
            value={number(s?.completedJobs ?? 0)}
            hint={
              s?.fulfilmentRate !== null && s?.fulfilmentRate !== undefined
                ? `${s.fulfilmentRate}% of paid jobs`
                : undefined
            }
            tone={s && s.fulfilmentRate !== null && s.fulfilmentRate < 90 ? 'warning' : 'success'}
            icon={<Icon name="check" className="w-4 h-4" />}
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
            label="Failed"
            value={number(s?.failedJobs ?? 0)}
            hint={s ? `avg print ${duration(s.avgPrintSeconds)}` : undefined}
            tone={s && s.failedJobs > 0 ? 'error' : 'default'}
            icon={<Icon name="alert" className="w-4 h-4" />}
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
        </div>
      )}

      <Card>
        <CardHeader title="Revenue" subtitle={rangeLabel(summary.data?.range)} />
        <div className="p-4 sm:p-5">
          {series.error ? (
            <ErrorState message={series.error} onRetry={series.reload} />
          ) : (
            <RevenueChart series={series.data?.series ?? []} loading={series.loading} />
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Printers"
            subtitle={`${printers.data?.count ?? 0} registered`}
            action={
              <Link href="/printers" className="text-sm font-semibold text-accent">
                View all
              </Link>
            }
          />
          {printers.loading ? (
            <div className="p-4 space-y-2">
              <div className="skeleton h-12" />
              <div className="skeleton h-12" />
            </div>
          ) : printers.data?.printers.length ? (
            <ul className="divide-y divide-border">
              {printers.data.printers.slice(0, 4).map((p) => (
                <li key={p.printerId} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-text truncate">{p.name}</p>
                    <p className="text-xs text-text-muted truncate">{p.kiosk.code}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold capitalize flex items-center gap-1.5 flex-shrink-0 ${
                      p.status === 'online' ? 'text-success' : 'text-error'
                    }`}
                  >
                    <span aria-hidden="true" className="w-2 h-2 rounded-full bg-current" />
                    {p.status}
                  </span>
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

        <Card>
          <CardHeader
            title="Activity"
            subtitle="Jobs in this period"
            action={
              <Link href="/sessions" className="text-sm font-semibold text-accent">
                View all
              </Link>
            }
          />
          <dl className="p-4 sm:p-5 space-y-3">
            <Row label="Sessions started" value={number(s?.sessions ?? 0)} />
            <Row label="Jobs created" value={number(s?.totalJobs ?? 0)} />
            <Row label="Paid" value={number(s?.paidJobs ?? 0)} />
            <Row label="In progress" value={number(s?.inProgressJobs ?? 0)} />
            <Row label="Average order" value={currency(s?.averageOrderValue ?? 0)} />
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-sm font-bold text-text tabular">{value}</dd>
    </div>
  );
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
