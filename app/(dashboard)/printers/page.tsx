'use client';

import React from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/useApi';
import { useProfile } from '@/lib/useProfile';
import { useScope } from '@/lib/scope';
import { api, ApiError, type KioskRow, type OrganizationRow, type PrinterRow } from '@/lib/api';
import { dateOnly, dateTime, relativeAge } from '@/lib/format';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  SkeletonRows,
  StatusPill,
  Toast,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ModelBadge } from '@/components/BusinessModel';
import type { BusinessModelId } from '@/lib/businessModels';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import {
  CreateKioskModal,
  EditKioskModal,
  EditPrinterModal,
  EnrollPrinterModal,
  PrinterKeyModal,
} from '@/components/FleetModals';

/**
 * QR points and printers.
 *
 * A QR point ("kiosk" in the schema and API) is a place customers scan and the
 * queue of jobs waiting there - not a physical box. It can have several
 * printers: a paid job queues at the QR point and is taken by whichever
 * printer there is idle and capable, so two machines at one counter share the
 * load and cover for each other.
 *
 * A printer is the machine itself. A station is a printer MPrnt also supplied
 * the enclosure for - the same row, differently labelled.
 *
 * What a person can do here depends on their role:
 *  - super admin: add QR points, enroll printers, rotate and revoke keys;
 *  - shop staff with printers:manage: edit their QR points, and revoke their own
 *    printers as an emergency lever;
 *  - everyone else: read-only status.
 */
export default function PrintersPage() {
  const profile = useProfile();
  const { org } = useScope();
  const isSuper = profile?.role === 'super_admin';
  const canManage = Boolean(profile?.permissions.includes('printers:manage'));
  // With the switcher on "All shops", show which shop each row belongs to.
  const showShop = isSuper && !org;

  const printers = useApi<{ count: number; printers: PrinterRow[] }>('/printers');
  const kiosks = useApi<{ count: number; kiosks: KioskRow[] }>('/kiosks');
  const orgs = useApi<{ organizations: OrganizationRow[] }>(isSuper ? '/organizations' : null, [], {
    unscoped: true,
  });

  const [addKiosk, setAddKiosk] = React.useState(false);
  const [enroll, setEnroll] = React.useState(false);
  const [editKiosk, setEditKiosk] = React.useState<KioskRow | null>(null);
  const [editPrinter, setEditPrinter] = React.useState<PrinterRow | null>(null);
  const [secret, setSecret] = React.useState<{
    printerId: string;
    apiKey: string;
    rotated?: boolean;
  } | null>(null);
  const [toast, setToast] = React.useState<{ message: string; tone: 'success' | 'error' } | null>(
    null
  );

  const reloadAll = () => {
    printers.reload();
    kiosks.reload();
  };

  async function rotate(p: PrinterRow) {
    if (
      !confirm(
        `Issue a new key for ${p.printerId}? The current key stops working immediately, so the Pi goes offline until it is given the new one.`
      )
    ) {
      return;
    }
    try {
      const res = await api.post<{ printerId: string; apiKey: string }>(
        `/printers/${encodeURIComponent(p.printerId)}/rotate-key`
      );
      setSecret({ ...res, rotated: true });
      reloadAll();
    } catch (e) {
      setToast({ message: e instanceof ApiError ? e.message : 'Could not rotate the key', tone: 'error' });
    }
  }

  async function revoke(p: PrinterRow) {
    if (
      !confirm(
        `Revoke ${p.printerId}? It is cut off at once and cannot print. ${
          isSuper ? 'Rotating its key later restores it.' : 'Contact MPrnt to restore it.'
        }`
      )
    ) {
      return;
    }
    try {
      await api.post(`/printers/${encodeURIComponent(p.printerId)}/revoke`);
      setToast({ message: `${p.printerId} revoked`, tone: 'success' });
      reloadAll();
    } catch (e) {
      setToast({ message: e instanceof ApiError ? e.message : 'Could not revoke', tone: 'error' });
    }
  }

  const printerList = printers.data?.printers ?? [];
  const silent = printerList.filter((p) => p.silent).length;
  const unenrolledKiosks = (kiosks.data?.kiosks ?? []).filter((k) => k.printersTotal === 0);

  /**
   * Printers grouped by the partner that owns them, with that partner's
   * commercial model. The model comes from /organizations rather than the
   * printer rows, which do not carry it.
   */
  const groups = React.useMemo(() => {
    const models = new Map<string, BusinessModelId | null>(
      (orgs.data?.organizations ?? []).map((o) => [o.id, o.businessModel])
    );

    const byOrg = new Map<string, { orgId: string | null; name: string; printers: PrinterRow[] }>();
    for (const p of printerList) {
      // A printer whose QR point has no partner is a real state, not an error:
      // it is grouped under its own heading rather than dropped.
      const key = p.organization?.id ?? 'unassigned';
      let entry = byOrg.get(key);
      if (!entry) {
        entry = {
          orgId: p.organization?.id ?? null,
          name: p.organization?.name ?? 'No partner assigned',
          printers: [],
        };
        byOrg.set(key, entry);
      }
      entry.printers.push(p);
    }

    return Array.from(byOrg.entries())
      .map(([key, entry]) => ({
        key,
        ...entry,
        businessModel: entry.orgId ? models.get(entry.orgId) ?? null : null,
        stations: entry.printers.filter((p) => p.station.isStation).length,
        standalone: entry.printers.filter((p) => !p.station.isStation).length,
      }))
      // Unassigned last; it is an exception, not a partner.
      .sort((a, b) =>
        a.orgId === null ? 1 : b.orgId === null ? -1 : a.name.localeCompare(b.name)
      );
  }, [printerList, orgs.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Printers & QR points</h1>
          <p className="text-sm text-text-muted mt-1.5">
            Live status of every Raspberry Pi{showShop ? ' across all partners' : ''}
          </p>
        </div>
        {isSuper && (
          <div className="flex flex-wrap items-center gap-2">
            <OrgSwitcher />
            <Button size="sm" variant="secondary" onClick={() => setAddKiosk(true)}>
              <Icon name="plus" className="w-4 h-4" />
              Add QR point
            </Button>
            <Button size="sm" onClick={() => setEnroll(true)} disabled={!kiosks.data?.kiosks.length}>
              <Icon name="key" className="w-4 h-4" />
              Enroll printer
            </Button>
          </div>
        )}
      </div>

      {(silent > 0 || unenrolledKiosks.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {silent > 0 && (
            <Card className="p-4 border-error/40 bg-error/5">
              <p className="font-bold text-text">
                {silent} {silent === 1 ? 'printer has' : 'printers have'} gone quiet
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                No heartbeat recently. Paid jobs at that QR point wait for another free printer there, or until it reconnects.
              </p>
            </Card>
          )}
          {unenrolledKiosks.length > 0 && (
            <Card className="p-4 border-warning/40 bg-warning/5">
              <p className="font-bold text-text">
                {unenrolledKiosks.length} {unenrolledKiosks.length === 1 ? 'QR point has' : 'QR points have'} no
                printer
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {unenrolledKiosks.map((k) => k.kioskId).join(', ')} - customers can pay there, but
                nothing will print.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* ---------------- Printers ----------------
          Grouped into one box per partner when looking across all of them, so
          the fleet reads as "who has what" rather than one long list. Scoped
          to a single partner, the grouping would be a box around everything. */}
      {printers.error ? (
        <Card>
          <ErrorState message={printers.error} onRetry={printers.reload} />
        </Card>
      ) : printers.loading ? (
        <Card>
          <CardHeader title="Printers" subtitle="Loading…" />
          <SkeletonRows rows={3} />
        </Card>
      ) : printerList.length === 0 ? (
        <Card>
          <CardHeader title="Printers" subtitle="None yet" />
          <EmptyState
            title="No printers enrolled"
            message={
              isSuper
                ? 'Enroll a printer to give its Raspberry Pi a key. Until then, paid jobs queue.'
                : 'No printer is connected yet. Paid jobs will queue until one is. Contact MPrnt to set one up.'
            }
            icon={<Icon name="printer" className="w-6 h-6" />}
            action={
              isSuper && kiosks.data?.kiosks.length ? (
                <Button size="sm" onClick={() => setEnroll(true)}>
                  Enroll a printer
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : showShop ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.key}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
                <div className="min-w-0 order-2 sm:order-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {group.orgId ? (
                      <Link
                        href={`/organizations/${group.orgId}`}
                        className="text-[15px] font-semibold text-text hover:text-accent hover:underline truncate"
                      >
                        {group.name}
                      </Link>
                    ) : (
                      <h2 className="text-[15px] font-semibold text-text truncate">{group.name}</h2>
                    )}
                    <ModelBadge id={group.businessModel} />
                  </div>
                  <p className="text-xs sm:text-[13px] text-text-muted mt-0.5">
                    {fleetSummary(group.printers)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 order-1 sm:order-2">
                  {group.stations > 0 && (
                    <CountChip icon="building" label="station" count={group.stations} />
                  )}
                  {group.standalone > 0 && (
                    <CountChip icon="printer" label="printer" count={group.standalone} />
                  )}
                </div>
              </div>

              <ul className="divide-y divide-border border-t border-border">
                {group.printers.map((p) => (
                  <PrinterItem
                    key={p.printerId}
                    printer={p}
                    isSuper={Boolean(isSuper)}
                    canManage={canManage}
                    showShop={false}
                    onRotate={rotate}
                    onRevoke={revoke}
                    onEdit={setEditPrinter}
                  />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader title="Printers" subtitle={printerSubtitle(printerList)} />
          <ul className="divide-y divide-border">
            {printerList.map((p) => (
              <PrinterItem
                key={p.printerId}
                printer={p}
                isSuper={Boolean(isSuper)}
                canManage={canManage}
                showShop={false}
                onRotate={rotate}
                onRevoke={revoke}
                onEdit={setEditPrinter}
              />
            ))}
          </ul>
        </Card>
      )}
      {/* ---------------- QR points ---------------- */}
      <Card>
        <CardHeader
          title="QR points"
          subtitle={`${kiosks.data?.count ?? 0} total · one QR code each; jobs print on whichever printer there is free`}
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
                    {k.location}
                    {showShop && k.organizationName ? ` · ${k.organizationName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden xs:block">
                    <p className="text-sm font-semibold text-text tabular">
                      {k.printersOnline}/{k.printersTotal}
                    </p>
                    <p className="text-xs text-text-muted">online</p>
                  </div>
                  <StatusPill status={k.status} />
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditKiosk(k)}
                      aria-label={`Edit kiosk ${k.kioskId}`}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No QR points yet"
            icon={<Icon name="building" className="w-6 h-6" />}
            action={
              isSuper ? (
                <Button size="sm" onClick={() => setAddKiosk(true)}>
                  Add a QR point
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>

      {isSuper && (
        <>
          <CreateKioskModal
            open={addKiosk}
            organizations={orgs.data?.organizations ?? []}
            defaultOrgId={org?.id}
            onClose={() => setAddKiosk(false)}
            onCreated={() => {
              setAddKiosk(false);
              setToast({ message: 'QR point added. Enroll a printer for it next.', tone: 'success' });
              reloadAll();
            }}
          />
          <EnrollPrinterModal
            open={enroll}
            kiosks={kiosks.data?.kiosks ?? []}
            onClose={() => setEnroll(false)}
            onEnrolled={(printerId, apiKey) => {
              setEnroll(false);
              setSecret({ printerId, apiKey });
              reloadAll();
            }}
          />
        </>
      )}

      <EditKioskModal
        kiosk={editKiosk}
        onClose={() => setEditKiosk(null)}
        onSaved={() => {
          setEditKiosk(null);
          setToast({ message: 'QR point updated', tone: 'success' });
          kiosks.reload();
        }}
      />

      <PrinterKeyModal secret={secret} onClose={() => setSecret(null)} />

      <EditPrinterModal
        printer={editPrinter}
        onClose={() => setEditPrinter(null)}
        onSaved={(label: string) => {
          setEditPrinter(null);
          setToast({ message: `${label} updated`, tone: 'success' });
          reloadAll();
        }}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}

/**
 * One printer in the fleet list.
 *
 * A station is shown by its station name and a "Station" badge, but it is the
 * same row with the same printer id underneath: a station contains exactly one
 * printer, and that printer is what heartbeats, queues and earns.
 */
function PrinterItem({
  printer: p,
  isSuper,
  canManage,
  showShop,
  onRotate,
  onRevoke,
  onEdit,
}: {
  printer: PrinterRow;
  isSuper: boolean;
  canManage: boolean;
  showShop: boolean;
  onRotate: (p: PrinterRow) => void;
  onRevoke: (p: PrinterRow) => void;
  onEdit: (p: PrinterRow) => void;
}) {
  const revoked = p.status === 'revoked';
  const station = p.station.isStation;

  return (
    <li className={`p-4 sm:p-5 ${revoked ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span
            aria-hidden="true"
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              p.status === 'online' && !p.silent
                ? 'bg-success/10 text-success'
                : revoked
                  ? 'bg-text-muted/10 text-text-muted'
                  : 'bg-error/10 text-error'
            }`}
          >
            <Icon name={station ? 'building' : 'printer'} className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-text truncate">{p.station.label}</p>
              <StationBadge isStation={station} />
            </div>
            <p className="text-xs text-text-muted truncate">
              {p.kiosk.code} · {p.kiosk.name}
              {showShop && p.organization ? ` · ${p.organization.name}` : ''}
            </p>
            <p className="text-xs text-text-muted font-mono truncate mt-0.5">
              {p.printerId}
              {/* The printer's own name still matters when the station is
                  named something else: it is what the Pi reports. */}
              {station && p.station.name ? ` · printer "${p.name}"` : ''}
            </p>
          </div>
        </div>
        <StatusPill status={p.status} />
      </div>

      <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Metric
          label="Last heartbeat"
          value={
            revoked
              ? '-'
              : p.secondsSinceHeartbeat !== null
                ? relativeAge(p.secondsSinceHeartbeat)
                : 'never'
          }
          warn={p.silent}
          title={dateTime(p.lastHeartbeat)}
        />
        <Metric label="Active jobs" value={String(p.activeJobs)} />
        <Metric
          label="Paper"
          value={p.paperLevel !== null ? `${p.paperLevel}%` : 'unknown'}
          warn={p.paperLevel !== null && p.paperLevel < 15}
        />
        <Metric
          label="Toner"
          value={p.inkLevelBlack !== null ? `${p.inkLevelBlack}%` : 'unknown'}
          warn={p.inkLevelBlack !== null && p.inkLevelBlack < 15}
        />
      </dl>

      <p className="mt-2 text-xs text-text-muted">
        {p.capabilities.color ? 'Colour' : 'Black & white only'}
        {p.capabilities.doubleSided ? ' · double-sided' : ' · single-sided only'}
      </p>

      {isSuper && (
        <p className="mt-1 text-xs text-text-muted">
          {revoked ? (
            <>Revoked {dateOnly(p.enrollment.revokedAt)}</>
          ) : p.enrollment.keyPrefix ? (
            <>
              Key <span className="font-mono">{p.enrollment.keyPrefix}…</span> issued{' '}
              {dateOnly(p.enrollment.keyIssuedAt)}
              {p.enrollment.lastSeenIp ? ` · last seen from ${p.enrollment.lastSeenIp}` : ''}
            </>
          ) : (
            <>No key issued</>
          )}
        </p>
      )}

      {(isSuper || (canManage && !revoked)) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {isSuper && (
            <Button size="sm" variant="secondary" onClick={() => onEdit(p)}>
              <Icon name="cog" className="w-4 h-4" />
              Edit
            </Button>
          )}
          {isSuper && (
            <Button size="sm" variant="secondary" onClick={() => onRotate(p)}>
              <Icon name="key" className="w-4 h-4" />
              {revoked ? 'Restore with new key' : 'Rotate key'}
            </Button>
          )}
          {canManage && !revoked && (
            <Button size="sm" variant="ghost" className="text-error" onClick={() => onRevoke(p)}>
              Revoke
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/** Says whether a unit is an MPrnt station or the partner's own printer. */
function StationBadge({ isStation }: { isStation: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${
        isStation ? 'bg-accent/10 text-accent' : 'bg-text-muted/10 text-text-muted'
      }`}
      title={
        isStation
          ? 'An MPrnt station. The printer inside it is this row.'
          : 'The partner’s own printer, connected to MPrnt.'
      }
    >
      {isStation ? 'Station' : 'Printer'}
    </span>
  );
}

/** Compact "2 stations" / "1 printer" counter for a partner's box header. */
function CountChip({
  icon,
  label,
  count,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  count: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-secondary text-xs font-medium text-text-muted whitespace-nowrap">
      <Icon name={icon} className="w-3.5 h-3.5" />
      <span className="tabular font-semibold text-text">{count}</span>
      {count === 1 ? label : `${label}s`}
    </span>
  );
}

/** "3 of 4 online · 1 station, 2 printers" for a partner's box header. */
function fleetSummary(list: PrinterRow[]): string {
  const live = list.filter((p) => p.status !== 'revoked');
  // "Busy" means mid-job, which is a working printer, so it counts as online.
  // Only silence or a reported offline state means work cannot reach it.
  const reachable = live.filter(
    (p) => (p.status === 'online' || p.status === 'busy') && !p.silent
  ).length;
  const printing = live.filter((p) => p.status === 'busy').length;
  const revoked = list.length - live.length;

  const parts = [`${reachable} of ${live.length} online`];
  if (printing > 0) parts.push(`${printing} printing`);
  if (revoked > 0) parts.push(`${revoked} revoked`);
  return parts.join(' · ');
}

function Metric({
  label,
  value,
  warn,
  title,
}: {
  label: string;
  value: string;
  warn?: boolean;
  title?: string;
}) {
  return (
    <div title={title}>
      <dt className="text-text-muted">{label}</dt>
      <dd className={`font-semibold mt-0.5 ${warn ? 'text-warning' : 'text-text'}`}>{value}</dd>
    </div>
  );
}

function printerSubtitle(list: PrinterRow[]): string {
  const revoked = list.filter((p) => p.status === 'revoked').length;
  const active = list.length - revoked;
  return `${active} active${revoked ? ` · ${revoked} revoked` : ''}`;
}
