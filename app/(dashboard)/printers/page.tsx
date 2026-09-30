'use client';

import React from 'react';
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
import {
  CreateKioskModal,
  EditKioskModal,
  EnrollPrinterModal,
  PrinterKeyModal,
} from '@/components/FleetModals';

/**
 * Kiosks and printers.
 *
 * What a person can do here depends on their role:
 *  - super admin: add kiosks, enroll printers, rotate and revoke keys;
 *  - shop staff with printers:manage: edit their kiosks, and revoke their own
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text">Printers & kiosks</h1>
          <p className="text-sm text-text-muted">
            Live status of every Raspberry Pi{showShop ? ' across all shops' : ''}
          </p>
        </div>
        {isSuper && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAddKiosk(true)}>
              <Icon name="plus" className="w-4 h-4" />
              Add kiosk
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
                No heartbeat recently. Paid jobs at that kiosk will wait until it reconnects.
              </p>
            </Card>
          )}
          {unenrolledKiosks.length > 0 && (
            <Card className="p-4 border-warning/40 bg-warning/5">
              <p className="font-bold text-text">
                {unenrolledKiosks.length} {unenrolledKiosks.length === 1 ? 'kiosk has' : 'kiosks have'} no
                printer
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {unenrolledKiosks.map((k) => k.kioskId).join(', ')} — customers can pay there, but
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
            {printerList.map((p) => {
              const revoked = p.status === 'revoked';
              return (
                <li key={p.printerId} className={`p-4 sm:p-5 ${revoked ? 'opacity-70' : ''}`}>
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
                        <Icon name="printer" className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-text truncate">{p.name}</p>
                        <p className="text-xs text-text-muted truncate">
                          {p.kiosk.code} · {p.kiosk.name}
                          {showShop && p.organization ? ` · ${p.organization.name}` : ''}
                        </p>
                        <p className="text-xs text-text-muted font-mono truncate mt-0.5">
                          {p.printerId}
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
                          ? '—'
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
                        <Button size="sm" variant="secondary" onClick={() => rotate(p)}>
                          <Icon name="key" className="w-4 h-4" />
                          {revoked ? 'Restore with new key' : 'Rotate key'}
                        </Button>
                      )}
                      {canManage && !revoked && (
                        <Button size="sm" variant="ghost" className="text-error" onClick={() => revoke(p)}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
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
        )}
      </Card>

      {/* ---------------- Kiosks ---------------- */}
      <Card>
        <CardHeader title="Kiosks" subtitle={`${kiosks.data?.count ?? 0} total`} />
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
            title="No kiosks yet"
            icon={<Icon name="building" className="w-6 h-6" />}
            action={
              isSuper ? (
                <Button size="sm" onClick={() => setAddKiosk(true)}>
                  Add a kiosk
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
              setToast({ message: 'Kiosk added. Enroll a printer for it next.', tone: 'success' });
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
          setToast({ message: 'Kiosk updated', tone: 'success' });
          kiosks.reload();
        }}
      />

      <PrinterKeyModal secret={secret} onClose={() => setSecret(null)} />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
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
