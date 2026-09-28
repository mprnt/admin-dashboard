'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import type { PrinterRow, KioskRow } from '@/lib/api';
import { relativeAge, dateTime } from '@/lib/format';
import { Card, CardHeader, StatusPill, EmptyState, ErrorState, SkeletonRows } from '@/components/ui';
import { Icon } from '@/components/Icon';

export default function PrintersPage() {
  const printers = useApi<{ count: number; printers: PrinterRow[] }>('/printers');
  const kiosks = useApi<{ count: number; kiosks: KioskRow[] }>('/kiosks');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text">Printers</h1>
        <p className="text-sm text-text-muted">
          Live status of every Raspberry Pi connected to your kiosks
        </p>
      </div>

      <Card>
        <CardHeader title="Printers" subtitle={`${printers.data?.count ?? 0} registered`} />

        {printers.error ? (
          <ErrorState message={printers.error} onRetry={printers.reload} />
        ) : printers.loading ? (
          <SkeletonRows rows={3} />
        ) : printers.data?.printers.length ? (
          <ul className="divide-y divide-border">
            {printers.data.printers.map((p) => (
              <li key={p.printerId} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      aria-hidden="true"
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        p.status === 'online'
                          ? 'bg-success/10 text-success'
                          : 'bg-error/10 text-error'
                      }`}
                    >
                      <Icon name="printer" className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-text truncate">{p.name}</p>
                      <p className="text-xs text-text-muted truncate">
                        {p.kiosk.code} · {p.kiosk.name}
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
                      p.secondsSinceHeartbeat !== null
                        ? relativeAge(p.secondsSinceHeartbeat)
                        : '—'
                    }
                    warn={Boolean(p.secondsSinceHeartbeat && p.secondsSinceHeartbeat > 180)}
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
                  Supports {p.capabilities.color ? 'colour' : 'black & white only'}
                  {p.capabilities.doubleSided ? ' · double-sided' : ' · single-sided only'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No printers enrolled"
            message="Enroll a Raspberry Pi against a kiosk to start printing. Until then, paid jobs will queue."
            icon={<Icon name="printer" className="w-6 h-6" />}
          />
        )}
      </Card>

      <Card>
        <CardHeader title="Kiosks" subtitle={`${kiosks.data?.count ?? 0} total`} />
        {kiosks.loading ? (
          <SkeletonRows rows={2} />
        ) : kiosks.data?.kiosks.length ? (
          <ul className="divide-y divide-border">
            {kiosks.data.kiosks.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-text truncate">
                    {k.kioskId} · {k.name}
                  </p>
                  <p className="text-xs text-text-muted truncate">{k.location}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-text tabular">
                    {k.printersOnline}/{k.printersTotal}
                  </p>
                  <p className="text-xs text-text-muted">online</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No kiosks assigned" icon={<Icon name="building" className="w-6 h-6" />} />
        )}
      </Card>
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
