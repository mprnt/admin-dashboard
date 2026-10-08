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
import { ModelBadge } from '@/components/BusinessModel';
import { BUSINESS_MODELS, type BusinessModelId } from '@/lib/businessModels';

type SortKey = 'revenue' | 'change' | 'name' | 'lastPaid';

const ACTIVITY: Record<ShopActivity, { label: string; tone: string }> = {
  active: { label: 'Active', tone: 'bg-success/10 text-success border-success/30' },
  new: { label: 'New', tone: 'bg-info/10 text-info border-info/30' },
  inactive: { label: 'Inactive', tone: 'bg-warning/10 text-warning border-warning/30' },
  suspended: { label: 'Suspended', tone: 'bg-error/10 text-error border-error/30' },
};

/**
 * Every partner side by side. Platform scope only.
 *
 * "Partner" is the business's word for what the schema calls an organization;
 * the API still says organizations.
 *
 * Deliberately unscoped: the shop filter narrows the rest of the dashboard to
 * one partner, but a comparison of one row would be pointless.
 */
export default function OrganizationsPage() {
  const [period, setPeriod] = React.useState<Period>('month');
  const [filter, setFilter] = React.useState<ShopActivity | 'all'>('all');
  const [model, setModel] = React.useState<BusinessModelId | 'none' | 'all'>('all');
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
    const byModel =
      model === 'all'
        ? all
        : all.filter((r) =>
            model === 'none'
              ? !r.organization.businessModel
              : r.organization.businessModel === model
          );
    const filtered = filter === 'all' ? byModel : byModel.filter((r) => r.activity === filter);
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
  }, [data, filter, model, sort]);

  // Each filter row counts what picking it would actually show, so the numbers
  // never promise rows that the other filter has already excluded.
  const inModel = React.useMemo(
    () =>
      (data?.organizations ?? []).filter((r) =>
        model === 'all'
          ? true
          : model === 'none'
            ? !r.organization.businessModel
            : r.organization.businessModel === model
      ),
    [data, model]
  );

  const counts = React.useMemo(() => {
    const c: Record<ShopActivity, number> = { active: 0, new: 0, inactive: 0, suspended: 0 };
    for (const r of inModel) c[r.activity]++;
    return c;
  }, [inModel]);

  const inActivity = React.useMemo(
    () => (data?.organizations ?? []).filter((r) => filter === 'all' || r.activity === filter),
    [data, filter]
  );

  const modelCounts = React.useMemo(() => {
    const c = new Map<string, number>();
    for (const r of inActivity) {
      const key = r.organization.businessModel ?? 'none';
      c.set(key, (c.get(key) ?? 0) + 1);
    }
    return c;
  }, [inActivity]);

  /** Active partners split by model — the breakdown behind the headline count. */
  const activeByModel = React.useMemo(() => {
    const c = new Map<string, number>();
    for (const r of data?.organizations ?? []) {
      if (r.activity !== 'active') continue;
      const key = r.organization.businessModel ?? 'none';
      c.set(key, (c.get(key) ?? 0) + 1);
    }
    return c;
  }, [data]);

  const t = data?.totals;
  const trendLabel = TREND_LABEL[period];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Partners</h1>
          <p className="text-sm text-text-muted mt-1.5">
            How every partner is performing, side by side
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" className="w-4 h-4" />
          New partner
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
        <ActiveByModel
          total={activeByModel}
          allCount={data?.organizations.length ?? 0}
          loading={loading}
          onPick={(id) => {
            setFilter('active');
            setModel(id);
          }}
        />
        <Stat
          label="Inactive partners"
          value={`${counts.inactive}`}
          hint={data ? `no paid job in ${data.inactiveAfterDays}+ days` : undefined}
          tone={counts.inactive > 0 ? 'warning' : 'default'}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader
          title={loading ? 'Loading…' : `${rows.length} ${rows.length === 1 ? 'partner' : 'partners'}`}
          subtitle="Compared with the same point in the previous period"
        />

        <div className="p-4 border-b border-border space-y-3">
          <div role="radiogroup" aria-label="Filter by business model" className="flex flex-wrap gap-2">
            {(['all', ...BUSINESS_MODELS.map((m) => m.id), 'none'] as const).map((value) => {
              const active = model === value;
              const count =
                value === 'all' ? inActivity.length : modelCounts.get(value) ?? 0;
              const info = BUSINESS_MODELS.find((m) => m.id === value);
              return (
                <button
                  key={value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setModel(value as BusinessModelId | 'none' | 'all')}
                  title={info ? `${info.label} — ${info.name}` : undefined}
                  className={`px-3 py-1.5 min-h-[36px] rounded-full border text-sm font-medium transition-colors ${
                    active
                      ? 'bg-accent/10 border-accent/50 text-accent'
                      : 'border-border text-text-muted hover:text-text'
                  }`}
                >
                  {value === 'all' ? 'All models' : info ? info.short : 'No model'}{' '}
                  <span className="tabular font-normal">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
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
        </div>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <SkeletonRows rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              filter === 'all' && model === 'all'
                ? 'No partners yet'
                : 'No partners match these filters'
            }
            message={
              filter === 'all' && model === 'all'
                ? 'Create a partner, then add a QR point and an owner.'
                : 'Try a different model or activity filter.'
            }
            icon={<Icon name="building" className="w-6 h-6" />}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block scroll-x">
              <table className="w-full text-sm">
                <caption className="sr-only">Partners compared for the selected period</caption>
                <thead>
                  <tr className="text-left text-text-muted bg-surface-secondary/70 border-y border-border/70">
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5">Partner</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5">Model</th>
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
                          {r.kiosks} {r.kiosks === 1 ? 'QR point' : 'QR points'}
                        </div>
                      </th>
                      <td className="px-5 py-3">
                        <ModelBadge id={r.organization.businessModel} />
                      </td>
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
                        <div className="mt-1">
                          <ModelBadge id={r.organization.businessModel} />
                        </div>
                        <p className="text-xs text-text-muted mt-1">
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
          setToast('Partner created. Add a QR point and an owner from its page.');
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

/**
 * Active partners, and which models they are on.
 *
 * The headline number alone ("5 active") does not say what the platform is
 * actually made of; six stations and one integration is a different business
 * from the reverse. Each model is a button that filters the table to it.
 */
function ActiveByModel({
  total,
  allCount,
  loading,
  onPick,
}: {
  total: Map<string, number>;
  allCount: number;
  loading: boolean;
  onPick: (model: BusinessModelId | 'none') => void;
}) {
  const active = Array.from(total.values()).reduce((a, b) => a + b, 0);
  const rows = [
    ...BUSINESS_MODELS.map((m) => ({ id: m.id as BusinessModelId | 'none', label: m.short, count: total.get(m.id) ?? 0 })),
    { id: 'none' as const, label: 'No model', count: total.get('none') ?? 0 },
  ].filter((r) => r.count > 0);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="w-6 h-6 rounded-md bg-surface-sunken text-text-muted flex items-center justify-center flex-shrink-0"
        >
          <Icon name="building" className="w-3.5 h-3.5" />
        </span>
        <p className="text-[13px] font-medium text-text-muted truncate">Active partners</p>
      </div>

      {loading ? (
        <div className="skeleton h-8 w-20 mt-3" />
      ) : (
        <>
          <p className="text-2xl sm:text-3xl font-semibold text-success mt-3 tabular leading-none">
            {active}
          </p>
          <p className="text-xs text-text-muted mt-1">of {allCount} total</p>

          {rows.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 mt-3">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => onPick(r.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-secondary hover:bg-accent/10 hover:text-accent text-xs font-medium text-text-muted transition-colors"
                  >
                    <span className="tabular font-semibold text-text">{r.count}</span>
                    <span>×</span>
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

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
