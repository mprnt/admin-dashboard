'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@/lib/useApi';
import { useScope } from '@/lib/scope';
import {
  api,
  ApiError,
  buildQuery,
  type AdminUserRow,
  type AuditRow,
  type Comparison,
  type KioskRow,
  type OrganizationRow,
  type Period,
  type PrinterRow,
  type Range,
  type SeriesPoint,
  type Summary,
} from '@/lib/api';
import { currency, dateOnly, dateTime, number, titleCase } from '@/lib/format';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  SkeletonRows,
  Stat,
  StatusPill,
  Toast,
} from '@/components/ui';
import { PeriodFilter } from '@/components/PeriodFilter';
import { RevenueChart } from '@/components/RevenueChart';
import { Icon } from '@/components/Icon';
import {
  AssignKioskModal,
  CreateKioskModal,
  EditKioskModal,
} from '@/components/FleetModals';

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

/**
 * One shop, from the platform's side: the same figures its owner sees, plus
 * the controls only the platform holds.
 */
export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setOrg } = useScope();
  const [period, setPeriod] = React.useState<Period>('month');
  const [toast, setToast] = React.useState<{ message: string; tone: 'success' | 'error' } | null>(
    null
  );
  const [addKiosk, setAddKiosk] = React.useState(false);
  const [moveKiosk, setMoveKiosk] = React.useState(false);
  const [editKiosk, setEditKiosk] = React.useState<KioskRow | null>(null);

  const q = (extra: Record<string, string | number | undefined> = {}) =>
    buildQuery({ organizationId: id, ...extra });

  const org = useApi<OrganizationRow>(`/organizations/${id}`, [], { unscoped: true });
  const summary = useApi<{ range: Range; summary: Summary; comparison: Comparison | null }>(
    `/reports/summary${q({ period })}`,
    [],
    { unscoped: true }
  );
  const series = useApi<{ series: SeriesPoint[] }>(`/reports/series${q({ period })}`, [], {
    unscoped: true,
  });
  const kiosks = useApi<{ kiosks: KioskRow[] }>(`/kiosks${q()}`, [], { unscoped: true });
  const allKiosks = useApi<{ kiosks: KioskRow[] }>('/kiosks', [], { unscoped: true });
  const printers = useApi<{ printers: PrinterRow[] }>(`/printers${q()}`, [], { unscoped: true });
  const staff = useApi<{ users: AdminUserRow[] }>(`/users${q()}`, [], { unscoped: true });
  const audit = useApi<{ entries: AuditRow[] }>(`/audit${q({ limit: 8 })}`, [], {
    unscoped: true,
  });

  const o = org.data;
  const s = summary.data?.summary;
  const cmp = summary.data?.comparison ?? null;
  const trendLabel = TREND_LABEL[period];

  async function act(fn: () => Promise<unknown>, message: string, after?: () => void) {
    try {
      await fn();
      setToast({ message, tone: 'success' });
      org.reload();
      after?.();
    } catch (e) {
      setToast({ message: e instanceof ApiError ? e.message : 'Action failed', tone: 'error' });
    }
  }

  if (org.error) {
    return (
      <Card>
        <ErrorState message={org.error} onRetry={org.reload} />
      </Card>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <Link
          href="/organizations"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text min-h-[32px]"
        >
          <span aria-hidden="true">←</span> All shops
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mt-1">
          <div className="min-w-0">
            {org.loading ? (
              <div className="skeleton h-8 w-56" />
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="page-title truncate">{o?.name}</h1>
                {o && <StatusPill status={o.status} />}
              </div>
            )}
            {o && (
              <p className="text-sm text-text-muted mt-0.5">
                {o.timezone} · since {dateOnly(o.createdAt)}
                {o.contactEmail ? ` · ${o.contactEmail}` : ''}
              </p>
            )}
          </div>

          {o && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setOrg({ id: o.id, name: o.name });
                  router.push('/');
                }}
              >
                <Icon name="chart" className="w-4 h-4" />
                Open their dashboard
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  act(
                    () =>
                      api.post(`/organizations/${o.id}/status`, {
                        status: o.status === 'active' ? 'suspended' : 'active',
                      }),
                    o.status === 'active' ? 'Shop suspended - its staff were signed out' : 'Shop reactivated'
                  )
                }
              >
                {o.status === 'active' ? 'Suspend' : 'Reactivate'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-error"
                onClick={() => {
                  if (
                    confirm(
                      `Delete ${o.name}? Its staff are signed out and lose access. Move its kiosks elsewhere first - deletion is refused while it still has any.`
                    )
                  ) {
                    void act(() => api.del(`/organizations/${o.id}`), 'Shop deleted', () =>
                      router.push('/organizations')
                    );
                  }
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      {o?.status === 'suspended' && (
        <Card className="p-4 border-error/40 bg-error/5">
          <p className="text-sm text-text">
            <span className="font-semibold">This shop is suspended.</span> Its staff cannot sign in.
            Reactivate it to restore access.
          </p>
        </Card>
      )}

      <PeriodFilter value={period} onChange={setPeriod} timezone={summary.data?.range.timezone} />

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
            loading={summary.loading}
            trend={
              cmp
                ? { pct: cmp.change.revenuePct, hasCurrent: cmp.current.revenue > 0, label: trendLabel }
                : undefined
            }
          />
          <Stat
            label="Paid jobs"
            value={number(s?.paidJobs ?? 0)}
            hint={s ? `avg order ${currency(s.averageOrderValue)}` : undefined}
            loading={summary.loading}
            trend={
              cmp
                ? { pct: cmp.change.paidJobsPct, hasCurrent: cmp.current.paidJobs > 0, label: trendLabel }
                : undefined
            }
          />
          <Stat
            label="Fulfilment"
            value={s?.fulfilmentRate !== null && s?.fulfilmentRate !== undefined ? `${s.fulfilmentRate}%` : '-'}
            hint="of paid jobs printed"
            tone={
              s && s.fulfilmentRate !== null ? (s.fulfilmentRate < 90 ? 'warning' : 'success') : 'default'
            }
            loading={summary.loading}
          />
          <Stat
            label="Failed"
            value={number(s?.failedJobs ?? 0)}
            tone={s && s.failedJobs > 0 ? 'error' : 'default'}
            loading={summary.loading}
            trend={
              cmp
                ? {
                    pct: pctChange(cmp.current.failedJobs, cmp.previous.failedJobs),
                    hasCurrent: cmp.current.failedJobs > 0,
                    invert: true,
                    label: trendLabel,
                  }
                : undefined
            }
          />
        </div>
      )}

      <Card>
        <CardHeader title="Revenue" />
        <div className="p-4 sm:p-5">
          {series.error ? (
            <ErrorState message={series.error} onRetry={series.reload} />
          ) : (
            <RevenueChart series={series.data?.series ?? []} loading={series.loading} />
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Kiosks */}
        <Card>
          <CardHeader
            title="Kiosks"
            subtitle={`${kiosks.data?.kiosks.length ?? 0} in this shop`}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setMoveKiosk(true)}>
                  Move here
                </Button>
                <Button size="sm" onClick={() => setAddKiosk(true)}>
                  <Icon name="plus" className="w-4 h-4" />
                  Add
                </Button>
              </div>
            }
          />
          {kiosks.error ? (
            <ErrorState message={kiosks.error} onRetry={kiosks.reload} />
          ) : kiosks.loading ? (
            <SkeletonRows rows={2} />
          ) : kiosks.data?.kiosks.length ? (
            <ul className="divide-y divide-border">
              {kiosks.data.kiosks.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-text truncate">
                      <span className="font-mono">{k.kioskId}</span> · {k.name}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {k.location} · {k.printersOnline}/{k.printersTotal} printers online
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusPill status={k.status} />
                    <Button size="sm" variant="ghost" onClick={() => setEditKiosk(k)} aria-label={`Edit kiosk ${k.kioskId}`}>
                      Edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No kiosks yet"
              message="Add one, or move an existing kiosk to this shop."
              icon={<Icon name="building" className="w-6 h-6" />}
            />
          )}
        </Card>

        {/* Printers */}
        <Card>
          <CardHeader
            title="Printers"
            action={
              <Link href="/printers" className="text-sm font-semibold text-accent" onClick={() => o && setOrg({ id: o.id, name: o.name })}>
                Manage
              </Link>
            }
          />
          {printers.loading ? (
            <SkeletonRows rows={2} />
          ) : printers.data?.printers.length ? (
            <ul className="divide-y divide-border">
              {printers.data.printers.map((p) => (
                <li key={p.printerId} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-text truncate">{p.name}</p>
                    <p className="text-xs text-text-muted font-mono truncate">{p.printerId}</p>
                  </div>
                  <StatusPill status={p.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No printers enrolled"
              message="Paid jobs will queue until a printer is enrolled."
              icon={<Icon name="printer" className="w-6 h-6" />}
            />
          )}
        </Card>

        {/* Staff */}
        <Card>
          <CardHeader
            title="Staff"
            action={
              <Link
                href="/staff"
                className="text-sm font-semibold text-accent"
                onClick={() => o && setOrg({ id: o.id, name: o.name })}
              >
                Manage
              </Link>
            }
          />
          {staff.loading ? (
            <SkeletonRows rows={2} />
          ) : staff.data?.users.length ? (
            <ul className="divide-y divide-border">
              {staff.data.users.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-text truncate">{u.fullName || u.email}</p>
                    <p className="text-xs text-text-muted truncate">
                      {u.lastLoginAt ? `Signed in ${dateTime(u.lastLoginAt)}` : 'Never signed in'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-accent capitalize flex-shrink-0">
                    {u.role}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No staff yet"
              message="Add an owner from the Staff page so this shop can sign in."
              icon={<Icon name="users" className="w-6 h-6" />}
            />
          )}
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Link
                href="/audit"
                className="text-sm font-semibold text-accent"
                onClick={() => o && setOrg({ id: o.id, name: o.name })}
              >
                Full log
              </Link>
            }
          />
          {audit.loading ? (
            <SkeletonRows rows={3} />
          ) : audit.data?.entries.length ? (
            <ul className="divide-y divide-border">
              {audit.data.entries.map((e) => (
                <li key={e.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text truncate">{titleCase(e.action)}</p>
                    <ScopeTag scope={e.actorScope} />
                  </div>
                  <p className="text-xs text-text-muted truncate">
                    {e.actor ? e.actor.name || e.actor.email : 'System'} · {dateTime(e.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No activity yet" icon={<Icon name="shield" className="w-6 h-6" />} />
          )}
        </Card>
      </div>

      <CreateKioskModal
        open={addKiosk}
        organizations={o ? [o] : []}
        defaultOrgId={id}
        onClose={() => setAddKiosk(false)}
        onCreated={() => {
          setAddKiosk(false);
          setToast({ message: 'Kiosk added. Enroll a printer for it next.', tone: 'success' });
          kiosks.reload();
          allKiosks.reload();
        }}
      />

      <AssignKioskModal
        org={moveKiosk && o ? { id: o.id, name: o.name } : null}
        kiosks={allKiosks.data?.kiosks ?? []}
        onClose={() => setMoveKiosk(false)}
        onAssigned={() => {
          setMoveKiosk(false);
          setToast({ message: 'Kiosk moved to this shop', tone: 'success' });
          kiosks.reload();
          allKiosks.reload();
          printers.reload();
        }}
      />

      <EditKioskModal
        kiosk={editKiosk}
        onClose={() => setEditKiosk(null)}
        onSaved={() => {
          setEditKiosk(null);
          setToast({ message: 'Kiosk updated', tone: 'success' });
          kiosks.reload();
        }}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function ScopeTag({ scope }: { scope: 'platform' | 'shop' }) {
  return (
    <span
      className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${
        scope === 'platform'
          ? 'border-accent/40 text-accent bg-accent/10'
          : 'border-border text-text-muted'
      }`}
    >
      {scope === 'platform' ? 'MPrnt' : 'Shop'}
    </span>
  );
}
