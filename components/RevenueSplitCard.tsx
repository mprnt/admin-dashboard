'use client';

import { useApi } from '@/lib/useApi';
import { buildQuery, type Period } from '@/lib/api';
import { currency } from '@/lib/format';
import { Card, CardHeader, Stat } from '@/components/ui';

interface QrPointSplit {
  kioskId: string;
  kioskName: string;
  partnerSharePct: number | null;
  platformSharePct: number | null;
  source: 'qr_point' | 'partner' | null;
}

interface SplitView {
  applies: boolean;
  partnerDefault: { partnerSharePct: number; platformSharePct: number; effectiveFrom: string } | null;
  byQrPoint: QrPointSplit[];
}

interface SplitSummary {
  paidJobs: number;
  splitJobs: number;
  grossRevenue: number;
  partnerRevenue: number;
  platformRevenue: number;
  unsplitRevenue: number;
}

/** A plain percentage, 30% or 33.33%. */
function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Number(value.toFixed(2))}%`;
}

/**
 * Your share of the revenue, for partners on Model 2 · Option A. Read-only: the
 * split is set by MPRNT, and this card shows it and what it has earned you.
 *
 * It renders nothing for a partner on any other model, so the shop never sees a
 * split it does not have.
 */
export function RevenueSplitCard({ period }: { period: Period }) {
  const view = useApi<SplitView>('/revenue-split');
  const summary = useApi<SplitSummary>(`/revenue-split/summary${buildQuery({ period })}`, [period]);

  if (view.loading || !view.data?.applies) return null;

  const split = view.data;
  const s = summary.data;
  const cover = split.partnerDefault
    ? `You keep ${pct(split.partnerDefault.partnerSharePct)} of each paid sale. MPRNT keeps ${pct(split.partnerDefault.platformSharePct)}.`
    : 'Your split has not started yet, so sales are not split.';

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Your share of revenue" subtitle={cover} />

      {summary.error && <p className="px-4 pb-4 text-sm text-error sm:px-5">{summary.error}</p>}

      {s && (
        <div className="grid grid-cols-2 border-t border-border/70 lg:grid-cols-4 [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b lg:[&>*]:border-b-0 lg:[&>*:not(:last-child)]:border-r [&>*]:border-border/70">
          <Stat label="Collected" value={currency(s.grossRevenue)} bare />
          <Stat label="Your share" value={currency(s.partnerRevenue)} bare tone="success" />
          <Stat label="MPRNT share" value={currency(s.platformRevenue)} bare />
          <Stat
            label="Not split"
            value={currency(s.unsplitRevenue)}
            bare
            hint="Paid before your split started, so it stays as it was."
          />
        </div>
      )}

      {split.byQrPoint.length > 0 && (
        <ul className="divide-y divide-border/70 border-t border-border/70">
          {split.byQrPoint.map((k) => (
            <li key={k.kioskId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-5">
              <span className="font-medium text-text">{k.kioskName}</span>
              <span className="text-text-muted">
                {k.partnerSharePct === null ? (
                  'No split yet'
                ) : (
                  <>
                    You {pct(k.partnerSharePct)} · MPRNT {pct(k.platformSharePct)}
                    <span className="ml-2 text-xs">
                      {k.source === 'qr_point' ? 'set for this QR point' : 'partner default'}
                    </span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
