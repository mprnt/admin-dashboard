'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { buildQuery, type PriceListRow, type KioskRow } from '@/lib/api';
import { currency, dateTime } from '@/lib/format';
import {
  Card, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonRows, inputClass,
} from '@/components/ui';
import { ContactLine } from '@/components/ContactSupport';
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
  platform: 'MPrnt standard',
  organization: 'Your shop',
  kiosk: 'QR point',
};

/**
 * The rates that apply to this shop.
 *
 * Read-only: pricing is set by MPrnt. Rates are never edited in place, so the
 * history below is also the record of what customers were charged and when.
 */
export default function PricingPage() {
  const kiosks = useApi<{ kiosks: KioskRow[] }>('/kiosks');
  const [kioskId, setKioskId] = React.useState('');

  const info = useApi<PricingInfo>(`/pricing${buildQuery({ kioskId: kioskId || undefined })}`, [kioskId]);
  const lists = useApi<{ priceLists: PriceListRow[] }>('/pricing/lists');

  return (
    <div className="space-y-6">
      <PageHeader title="Pricing" subtitle="Rates that apply to your QR points" />

      <ContactLine subject="Pricing enquiry">
        Pricing is set by MPrnt. To discuss your rates:
      </ContactLine>

      <Card>
        <CardHeader
          title="Rates in force"
          subtitle="What a customer pays right now"
          action={
            kiosks.data && kiosks.data.kiosks.length > 0 ? (
              <>
                <label htmlFor="kiosk-select" className="sr-only">Show rates for QR point</label>
                <select
                  id="kiosk-select"
                  value={kioskId}
                  onChange={(e) => setKioskId(e.target.value)}
                  className={`${inputClass} text-sm py-1.5 min-h-[38px] w-40`}
                >
                  <option value="">Default</option>
                  {kiosks.data.kiosks.map((k) => (
                    <option key={k.id} value={k.id}>{k.kioskId}</option>
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
              Applied from the{' '}
              <span className="font-semibold">{SCOPE_LABEL[info.data.source] ?? info.data.source}</span>{' '}
              rate
              {info.data.minCharge > 0 && ` · minimum charge ${currency(info.data.minCharge)}`}
            </p>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Rate history"
          subtitle="Published rates, newest first. Rates are never edited - a change publishes a new entry."
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
                    From {dateTime(pl.effectiveFrom)}
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
