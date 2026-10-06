'use client';

import React from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/useApi';
import { buildQuery, type OrgComparison, type OrgComparisonRow, type Period, type ShopActivity } from '@/lib/api';
import { currency, currencyCompact, number, relativeAge } from '@/lib/format';
import { Card, CardHeader, Stat, ErrorState, EmptyState, SkeletonRows, Button, Toast } from '@/components/ui';
import { PeriodFilter } from '@/components/PeriodFilter';
import { Icon } from '@/components/Icon';
import { CreateOrgModal } from '@/components/FleetModals';

type SortKey = 'revenue' | 'change' | 'name' | 'lastPaid';

const ACTIVITY: Record<ShopActivity, { label: string; tone: string }> = {
  active: { label: 'Active', tone: 'bg-success/10 text-success border-success/30' },
  new: { label: 'New', tone: 'bg-info/10 text-info border-info/30' },
  inactive: { label: 'Inactive', tone: 'bg-warning/10 text-warning border-warning/30' },
  suspended: { label: 'Suspended', tone: 'bg-error/10 text-error border-error/30' },
};

/**
 * Every shop side by side. Platform scope only.
 *
 * Deliberately unscoped: the shop switcher narrows the rest of the dashboard to
 * one shop, but a comparison of one row would be pointless.
 */
export default function OrganizationsPage() {
  const [period, setPeriod] = React.useState<Period>('month');
  const [filter, setFilter] = React.useState<ShopActivity | 'all'>('all');
  const [sort, setSort] = React.useState<SortKey>('revenue');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const { data, error, loading, reload } = useApi<OrgComparison>(
    `/reports/organizations${buildQuery({ period })}`,
    [],
    { unscoped: true }
  );

  const rows = React.useMemo(() => {
    const all = data?.organizations ?? [];
    const filtered = filter === 'all' ? all : all.filter((r) => r.activity === filter);
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.organization.name.localeCompare(b.organization.name);
        case 'change':
          return (b.change.revenuePct ?? -Infinity) - (a.change.revenuePct ?? -Infinity);
        case 'lastPaid':
          return (a.daysSinceLastPaid ?? Infinity) - (b.daysSinceLastPaid ?? Infinity);
        default:
          return b.current.revenue - a.current.revenue;
      }
    });
    return sorted;
  }, [data, filter, sort]);

  const counts = React.useMemo(() => {
    const c: Record<ShopActivity, number> = { active: 0, new: 0, inactive: 0, suspended: 0 };
    for (const r of data?.organizations ?? []) c[r.activity]++;
    return c;
  }, [data]);

  const t = data?.totals;
  const trendLabel = TREND_LABEL[period];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Shops</h1>
          <p className="text-sm text-text-muted mt-1.5">How every shop is performing, side by side</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" className="w-4 h-4" />
          New shop
        </Button>
      </div>

      <PeriodFilter value={period} onChange={setPeriod} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat
          label="Platform revenue"
          value={currency(t?.current.revenue ?? 0)}
          loading={loading}
          trend={t ? { pct: t.change.revenuePct, hasCurrent: t.current.revenue > 0, label: trendLabel } : undefined}
        />
        <Stat
          label="Paid jobs"
          value={number(t?.current.paidJobs ?? 0)}
          loading={loading}
          trend={t ? { pct: t.change.paidJobsPct, hasCurrent: t.current.paidJobs > 0, label: trendLabel } : undefined}
        />
        <Stat
          label="Active shops"
          value={`${counts.active}`}
          hint={data ? `of ${data.organizations.length} total` : undefined}
          tone="success"
          loading={loading}
        />
        <Stat
          label="Inactive shops"
          value={`${counts.inactive}`}
          hint={data ? `no paid job in ${data.inactiveAfterDays}+ days` : undefined}
          tone={counts.inactive > 0 ? 'warning' : 'default'}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader
          title={loading ? 'Loading…' : `${rows.length} ${rows.length === 1 ? 'shop' : 'shops'}`}
          subtitle="Compared with the same point in the previous period"
        />

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between p-4 border-b border-border">
          <div role="radiogroup" aria-label="Filter by activity" className="flex flex-wrap gap-2">
            {(['all', 'active', 'inactive', 'new', 'suspended'] as const).map((f) => {
              const active = filter === f;
              const count = f === 'all' ? data?.organizations.length ?? 0 : counts[f];
              return (
                <button
                  key={f}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 min-h-[36px] rounded-full border text-sm font-semibold capitalize transition-colors ${
                    active
                      ? 'bg-accent/10 border-accent/50 text-accent'
                      : 'border-border text-text-muted hover:text-text'
                  }`}
                >
                  {f} <span className="tabular font-normal">({count})</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm text-text-muted whitespace-nowrap">
              Sort by
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="px-3 py-1.5 min-h-[36px] rounded-lg border border-border bg-surface text-sm text-text"
            >
              <option value="revenue">Revenue</option>
              <option value="change">Growth</option>
              <option value="lastPaid">Most recent sale</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <SkeletonRows rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={filter === 'all' ? 'No shops yet' : `No ${filter} shops`}
            message={filter === 'all' ? 'Create a shop, then add a kiosk and an owner.' : undefined}
            icon={<Icon name="building" className="w-6 h-6" />}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block scroll-x">
              <table className="w-full text-sm">
                <caption className="sr-only">Shops compared for the selected period</caption>
                <thead>
                  <tr className="text-left text-text-muted bg-surface-secondary/70 border-y border-border/70">
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5">Shop</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5 text-right">Revenue</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5 text-right whitespace-nowrap">Paid jobs</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5 text-right">Fulfilment</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5">Printers</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5">Last sale</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.organization.id} className="hover:bg-surface-secondary/70 transition-colors">
                      <th scope="row" className="px-5 py-3 text-left font-normal">
                        <Link
                          href={`/organizations/${r.organization.id}`}
                          className="font-semibold text-text hover:text-accent hover:underline"
                        >
                          {r.organization.name}
                        </Link>
                        <div className="text-xs text-text-muted">
                          {r.kiosks} {r.kiosks === 1 ? 'kiosk' : 'kiosks'}
                        </div>
                      </th>
                      <td className="px-5 py-3 text-right tabular">
                        <div className="font-semibold text-text">{currency(r.current.revenue)}</div>
                        <Delta pct={r.change.revenuePct} hasCurrent={r.current.revenue > 0} />
                      </td>
                      <td className="px-5 py-3 text-right tabular">
                        <div className="text-text">{number(r.current.paidJobs)}</div>
                        <Delta pct={r.change.paidJobsPct} hasCurrent={r.current.paidJobs > 0} />
                      </td>
                      <td className="px-5 py-3 text-right tabular">
                        <Fulfilment rate={r.fulfilmentRate} />
                      </td>
                      <td className="px-5 py-3">
                        <Printers row={r} />
                      </td>
                      <td className="px-5 py-3 text-text-muted whitespace-nowrap">
                        <LastSale row={r} />
                      </td>
                      <td className="px-5 py-3">
                        <ActivityBadge activity={r.activity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-border">
              {rows.map((r) => (
                <li key={r.organization.id}>
                  <Link
                    href={`/organizations/${r.organization.id}`}
                    className="block p-4 hover:bg-surface-secondary/70 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-text truncate">{r.organization.name}</p>
                        <p className="text-xs text-text-muted">
                          <LastSale row={r} />
                        </p>
                      </div>
                      <ActivityBadge activity={r.activity} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <p className="text-xs text-text-muted">Revenue</p>
                        <p className="font-semibold text-text tabular">
                          {currencyCompact(r.current.revenue)}
                        </p>
                        <Delta pct={r.change.revenuePct} hasCurrent={r.current.revenue > 0} />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">Paid jobs</p>
                        <p className="font-semibold text-text tabular">{number(r.current.paidJobs)}</p>
                        <Delta pct={r.change.paidJobsPct} hasCurrent={r.current.paidJobs > 0} />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">Printers</p>
                        <Printers row={r} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <CreateOrgModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setToast('Shop created. Add a kiosk and an owner from its page.');
          reload();
        }}
      />

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

const TREND_LABEL: Record<Period, string> = {
  day: 'vs this time yesterday',
  week: 'vs this point last week',
  month: 'vs this point last month',
  year: 'vs this point last year',
};

/** Compact period-over-period change for table cells. Arrow and words, not colour alone. */
function Delta({ pct, hasCurrent }: { pct: number | null; hasCurrent: boolean }) {
  if (pct === null) {
    return (
      <div className="text-xs text-text-muted">{hasCurrent ? 'new' : '-'}</div>
    );
  }
  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  return (
    <div
      className={`text-xs font-semibold whitespace-nowrap ${flat ? 'text-text-muted' : up ? 'text-success' : 'text-error'}`}
    >
      <span aria-hidden="true">{flat ? '→' : up ? '↑' : '↓'}</span>
      <span className="sr-only">{flat ? 'unchanged' : up ? 'up' : 'down'}</span> {Math.abs(pct)}%
    </div>
  );
}

function Fulfilment({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-text-muted">-</span>;
  const tone = rate >= 95 ? 'text-success' : rate >= 80 ? 'text-warning' : 'text-error';
  return <span className={`font-semibold ${tone}`}>{rate}%</span>;
}

function Printers({ row }: { row: OrgComparisonRow }) {
  if (row.printersTotal === 0) {
    return <span className="text-xs font-semibold text-warning">None enrolled</span>;
  }
  const allUp = row.printersOnline === row.printersTotal;
  return (
    <span className={`text-sm font-semibold tabular ${allUp ? 'text-success' : 'text-error'}`}>
      {row.printersOnline}/{row.printersTotal}
      <span className="font-normal text-text-muted"> online</span>
    </span>
  );
}

function LastSale({ row }: { row: OrgComparisonRow }) {
  if (row.daysSinceLastPaid === null || !row.lastPaidAt) return <>No sales yet</>;
  const seconds = (Date.now() - new Date(row.lastPaidAt).getTime()) / 1000;
  return <>{relativeAge(Math.max(0, seconds))}</>;
}

function ActivityBadge({ activity }: { activity: ShopActivity }) {
  const a = ACTIVITY[activity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${a.tone}`}
    >
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
      {a.label}
    </span>
  );
}
