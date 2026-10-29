'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { api, buildQuery, type PriceListRow, type KioskRow } from '@/lib/api';
import { currency, dateTime } from '@/lib/format';
import {
  Button, Card, CardHeader, EmptyState, ErrorState, Field, PageHeader, SkeletonRows, inputClass,
} from '@/components/ui';
import { useCan } from '@/lib/useProfile';
import { Icon } from '@/components/Icon';

interface PricingInfo {
  blackAndWhite: { pricePerPage: number; currency: string; description: string };
  color: { pricePerPage: number; currency: string; description: string };
  minCharge: number;
  source: 'platform' | 'organization' | 'kiosk';
}

/**
 * How a rate's reach reads on screen. The API's words are the schema's
 * ("organization", "kiosk"); these are what a shop recognises.
 */
const SCOPE_LABEL: Record<string, string> = {
  platform: 'MPRNT standard',
  organization: 'Your shop',
  kiosk: 'QR point',
};

/**
 * The rates that apply to this shop, and the shop's own rates to change them. The
 * owner and managers set the black-and-white and colour rates here. A rate is never
 * edited in place, so the history below is also the record of what customers were
 * charged and when.
 */
export default function PricingPage() {
  const kiosks = useApi<{ kiosks: KioskRow[] }>('/kiosks');
  const [kioskId, setKioskId] = React.useState('');

  const info = useApi<PricingInfo>(`/pricing${buildQuery({ kioskId: kioskId || undefined })}`, [kioskId]);
  const lists = useApi<{ priceLists: PriceListRow[] }>('/pricing/lists');

  return (
    <div className="space-y-6">
      <PageHeader title="Pricing" subtitle="What your customers pay for each page" />

      <YourRates
        current={info.data ?? null}
        onSaved={() => {
          info.reload();
          lists.reload();
        }}
      />

      <Card>
        <CardHeader
          title="Price per page today"
          subtitle="Choose a QR point to see its price"
          action={
            kiosks.data && kiosks.data.kiosks.length > 0 ? (
              <>
                <label htmlFor="kiosk-select" className="sr-only">Show rates for QR point</label>
                <select
                  id="kiosk-select"
                  value={kioskId}
                  onChange={(e) => setKioskId(e.target.value)}
                  className={`${inputClass} text-sm py-1.5 min-h-[44px] sm:min-h-[38px] w-40`}
                >
                  <option value="">Standard price</option>
                  {kiosks.data.kiosks.map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </>
            ) : undefined
          }
        />

        {info.error ? (
          <ErrorState message={info.error} onRetry={info.reload} />
        ) : info.loading ? (
          <SkeletonRows rows={2} />
        ) : info.data ? (
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-medium text-text-muted">Black & white</p>
                <p className="text-2xl sm:text-3xl font-bold text-text mt-1 tabular">
                  {currency(info.data.blackAndWhite.pricePerPage)}
                </p>
                <p className="text-xs text-text-muted">per page</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-medium text-text-muted">Colour</p>
                <p className="text-2xl sm:text-3xl font-bold text-accent mt-1 tabular">
                  {currency(info.data.color.pricePerPage)}
                </p>
                <p className="text-xs text-text-muted">per page</p>
              </div>
            </div>

            <p className="text-xs text-text-muted mt-3">
              This is the{' '}
              <span className="font-semibold">{SCOPE_LABEL[info.data.source] ?? info.data.source}</span>{' '}
              price
              {info.data.minCharge > 0 && ` · minimum charge ${currency(info.data.minCharge)}`}
            </p>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Past price changes"
          subtitle="Newest first. Each change is kept here, so you can see what was charged when."
        />
        {lists.error ? (
          <ErrorState message={lists.error} onRetry={lists.reload} />
        ) : lists.loading ? (
          <SkeletonRows rows={3} />
        ) : lists.data && lists.data.priceLists.length > 0 ? (
          <ul className="divide-y divide-border">
            {lists.data.priceLists.map((pl) => (
              <li key={pl.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-text">
                    {SCOPE_LABEL[pl.scope] ?? pl.scope}
                    {pl.kioskCode && (
                      <span className="text-text-muted font-normal"> · {pl.kioskCode}</span>
                    )}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    From {dateTime(pl.effectiveFrom)} · {pl.createdBy === 'shop' ? 'Set by you' : 'Set by MPRNT'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 tabular">
                  <p className="text-sm font-semibold text-text">
                    {currency(pl.bwPerPage)} <span className="text-text-muted font-normal">b/w</span>
                  </p>
                  <p className="text-sm font-semibold text-accent">
                    {currency(pl.colorPerPage)} <span className="text-text-muted font-normal">colour</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No rates published yet" icon={<Icon name="tag" className="w-6 h-6" />} />
        )}
      </Card>
    </div>
  );
}

/**
 * The shop's own black-and-white and colour rate. Owners and managers can change it; a
 * viewer sees it. The change takes effect from now, and the rates already quoted to
 * customers do not move.
 */
function YourRates({ current, onSaved }: { current: PricingInfo | null; onSaved: () => void }) {
  const canSet = useCan('shop:pricing:write');
  const [editing, setEditing] = React.useState(false);
  const [bw, setBw] = React.useState('');
  const [color, setColor] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  function startEditing() {
    setBw(current ? String(current.blackAndWhite.pricePerPage) : '');
    setColor(current ? String(current.color.pricePerPage) : '');
    setError(null);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const b = Number(bw);
    const c = Number(color);
    if (bw === '' || color === '' || !Number.isFinite(b) || !Number.isFinite(c)) {
      return setError('Enter both rates.');
    }
    if (b < 0 || c < 0 || b > 1000 || c > 1000) return setError('Each rate is between 0 and 1000.');
    if (Math.round(b * 100) !== b * 100 || Math.round(c * 100) !== c * 100) {
      return setError('Use at most two decimal places.');
    }

    setBusy(true);
    setError(null);
    try {
      await api.put('/shop/pricing', { bwPerPage: b, colorPerPage: c });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the rates. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Your rates"
        subtitle={
          canSet
            ? 'What customers pay per page. You set these; MPRNT does not change them.'
            : 'What customers pay per page. Only the owner or a manager can change them.'
        }
        action={
          canSet && !editing ? (
            <Button size="sm" variant="secondary" onClick={startEditing}>
              Change rates
            </Button>
          ) : undefined
        }
      />
      {editing ? (
        <form className="p-4 sm:p-5 space-y-4" onSubmit={save}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Black & white, per page" htmlFor="rate-bw" hint="In rupees, for example 2 or 1.50">
              <input
                id="rate-bw"
                type="number"
                inputMode="decimal"
                min={0}
                max={1000}
                step="0.01"
                className={inputClass}
                value={bw}
                onChange={(e) => setBw(e.target.value)}
                required
              />
            </Field>
            <Field label="Colour, per page" htmlFor="rate-color" hint="In rupees, for example 5 or 4.50">
              <input
                id="rate-color"
                type="number"
                inputMode="decimal"
                min={0}
                max={1000}
                step="0.01"
                className={inputClass}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                required
              />
            </Field>
          </div>
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save rates'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="p-4 sm:p-5 grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-text-muted">Black & white</p>
            <p className="text-2xl font-bold text-text mt-1 tabular">
              {current ? currency(current.blackAndWhite.pricePerPage) : '—'}
            </p>
            <p className="text-xs text-text-muted">per page</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-text-muted">Colour</p>
            <p className="text-2xl font-bold text-accent mt-1 tabular">
              {current ? currency(current.color.pricePerPage) : '—'}
            </p>
            <p className="text-xs text-text-muted">per page</p>
          </div>
        </div>
      )}
    </Card>
  );
}
