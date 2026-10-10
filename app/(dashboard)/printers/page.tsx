'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { useProfile } from '@/lib/useProfile';
import { api, ApiError, type KioskRow, type PrinterRow } from '@/lib/api';
import { dateTime, relativeAge } from '@/lib/format';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonRows,
  StatusPill,
  Toast,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ContactLine } from '@/components/ContactSupport';
import { EditKioskModal } from '@/components/FleetModals';

/**
 * Your QR points and the printers behind them.
 *
 * A QR point is a place customers scan, and the queue of jobs waiting there -
 * not a physical box. It can have several printers: a paid job queues at the QR
 * point and is taken by whichever printer there is idle and capable, so two
 * machines at one counter share the load and cover for each other.
 *
 * A printer is the machine itself. A station is a printer MPrnt also supplied
 * the enclosure for - the same row, differently labelled.
 *
 * What a person can do here depends on their permissions:
 *  - printers:manage: edit their QR points, and revoke a printer as an
 *    emergency lever (a stolen Pi should be cut off at once);
 *  - everyone else: read-only status.
 *
 * Adding a QR point, enrolling a printer and rotating its key are done by
 * MPrnt, because enrolling mints a secret. The page says so rather than
 * leaving a shop looking for a button that is not there.
 */
export default function PrintersPage() {
  const profile = useProfile();
  const canManage = Boolean(profile?.permissions.includes('printers:manage'));

  const printers = useApi<{ count: number; printers: PrinterRow[] }>('/printers');
  const kiosks = useApi<{ count: number; kiosks: KioskRow[] }>('/kiosks');

  const [editKiosk, setEditKiosk] = React.useState<KioskRow | null>(null);
  const [toast, setToast] = React.useState<{ message: string; tone: 'success' | 'error' } | null>(
    null
  );

  const reloadAll = () => {
    printers.reload();
    kiosks.reload();
  };

  async function revoke(p: PrinterRow) {
    if (
      !confirm(
        `Revoke ${p.station.label}? It is cut off at once and cannot print. Contact MPrnt to restore it.`
      )
    ) {
      return;
    }
    try {
      await api.post(`/printers/${encodeURIComponent(p.printerId)}/revoke`);
      setToast({ message: `${p.station.label} revoked`, tone: 'success' });
      reloadAll();
    } catch (e) {
      setToast({ message: e instanceof ApiError ? e.message : 'Could not revoke', tone: 'error' });
    }
  }

  const printerList = printers.data?.printers ?? [];
  const silent = printerList.filter((p) => p.silent).length;
  const unenrolledKiosks = (kiosks.data?.kiosks ?? []).filter((k) => k.printersTotal === 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Printers & QR points" subtitle="Live status of every Raspberry Pi" />

      {(silent > 0 || unenrolledKiosks.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {silent > 0 && (
            <Card className="p-4 border-error/40 bg-error/5">
              <p className="font-bold text-text">
                {silent} {silent === 1 ? 'printer has' : 'printers have'} gone quiet
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                No heartbeat recently. Paid jobs at that QR point wait for another free printer
                there, or until it reconnects.
              </p>
            </Card>
          )}
          {unenrolledKiosks.length > 0 && (
            <Card className="p-4 border-warning/40 bg-warning/5">
              <p className="font-bold text-text">
                {unenrolledKiosks.length}{' '}
                {unenrolledKiosks.length === 1 ? 'QR point has' : 'QR points have'} no printer
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {unenrolledKiosks.map((k) => k.kioskId).join(', ')} - customers can pay there, but
                nothing will print.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* ---------------- Printers ---------------- */}
      <Card>
        <CardHeader title="Printers" subtitle={printerSubtitle(printerList)} />

        {printers.error ? (
          <ErrorState message={printers.error} onRetry={printers.reload} />
        ) : printers.loading ? (
          <SkeletonRows rows={3} />
        ) : printerList.length ? (
          <ul className="divide-y divide-border">
            {printerList.map((p) => (
              <PrinterItem key={p.printerId} printer={p} canManage={canManage} onRevoke={revoke} />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No printers connected"
            message="No printer is connected yet. Paid jobs will queue until one is."
            icon={<Icon name="printer" className="w-6 h-6" />}
            action={
              <ContactLine subject="Connect a printer to my shop">Contact MPrnt to set one up:</ContactLine>
            }
          />
        )}
      </Card>

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
                  <p className="text-xs text-text-muted truncate">{k.location}</p>
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
                      aria-label={`Edit QR point ${k.kioskId}`}
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
              <ContactLine subject="Set up a QR point for my shop">Contact MPrnt to add one:</ContactLine>
            }
          />
        )}
      </Card>

      <p className="text-xs text-text-muted">
        QR points and printers are added and re-keyed by MPrnt. Need another, or something
        replaced? Use Contact in the sidebar.
      </p>

      <EditKioskModal
        kiosk={editKiosk}
        onClose={() => setEditKiosk(null)}
        onSaved={() => {
          setEditKiosk(null);
          setToast({ message: 'QR point updated', tone: 'success' });
          reloadAll();
        }}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}

/**
 * One printer.
 *
 * A station is shown by its station name and a "Station" badge, but it is the
 * same row with the same printer id underneath: a station contains exactly one
 * printer, and that printer is what heartbeats, queues and earns.
 */
function PrinterItem({
  printer: p,
  canManage,
  onRevoke,
}: {
  printer: PrinterRow;
  canManage: boolean;
  onRevoke: (p: PrinterRow) => void;
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
              (p.status === 'online' || p.status === 'busy') && !p.silent
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

      {canManage && !revoked && (
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="sm" variant="ghost" className="text-error" onClick={() => onRevoke(p)}>
            Revoke
          </Button>
        </div>
      )}
    </li>
  );
}

/** Says whether a unit is an MPrnt station or the shop's own printer. */
function StationBadge({ isStation }: { isStation: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${
        isStation ? 'bg-accent/10 text-accent' : 'bg-text-muted/10 text-text-muted'
      }`}
      title={
        isStation
          ? 'An MPrnt station. The printer inside it is this row.'
          : 'Your own printer, connected to MPrnt.'
      }
    >
      {isStation ? 'Station' : 'Printer'}
    </span>
  );
}

function Metric({
  label,
  value,
  warn = false,
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
  const live = list.length - revoked;
  const printing = list.filter((p) => p.status === 'busy').length;
  const parts = [`${live} active`];
  if (printing > 0) parts.push(`${printing} printing`);
  if (revoked > 0) parts.push(`${revoked} revoked`);
  return parts.join(' · ');
}
