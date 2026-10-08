'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { api, ApiError, buildQuery, type PriceListRow, type OrganizationRow, type KioskRow } from '@/lib/api';
import { currency, dateTime } from '@/lib/format';
import {
  Card, CardHeader, EmptyState, ErrorState, SkeletonRows,
  Button, Modal, Field, inputClass, Toast,
} from '@/components/ui';
import { ContactLine } from '@/components/ContactSupport';
import { Icon } from '@/components/Icon';
import { useProfile } from '@/lib/useProfile';

interface PricingInfo {
  blackAndWhite: { pricePerPage: number; currency: string; description: string };
  color: { pricePerPage: number; currency: string; description: string };
  minCharge: number;
  source: 'platform' | 'organization' | 'kiosk';
}

/**
 * How a rate's reach reads on screen. The API's words are the schema's
 * ("organization", "kiosk"); these are the business's.
 */
const SCOPE_LABEL: Record<string, string> = {
  platform: 'Platform',
  organization: 'Partner',
  kiosk: 'QR point',
};

export default function PricingPage() {
  const profile = useProfile();
  const canWrite = profile?.permissions.includes('pricing:write');

  const kiosks = useApi<{ kiosks: KioskRow[] }>('/kiosks');
  const [kioskId, setKioskId] = React.useState('');

  const info = useApi<PricingInfo>(`/pricing${buildQuery({ kioskId: kioskId || undefined })}`, [kioskId]);
  const lists = useApi<{ priceLists: PriceListRow[] }>('/pricing/lists');
  const orgs = useApi<{ organizations: OrganizationRow[] }>(canWrite ? '/organizations' : null);

  const [publishOpen, setPublishOpen] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Pricing</h1>
          <p className="text-sm text-text-muted mt-1.5">
            {canWrite ? 'Rates charged to customers at each QR point' : 'Rates that apply to your QR points'}
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setPublishOpen(true)}>
            <Icon name="plus" className="w-4 h-4" />
            Publish rates
          </Button>
        )}
      </div>

      {!canWrite && (
        <ContactLine subject="Pricing enquiry">
          Pricing is set by MPrnt. To discuss your rates:
        </ContactLine>
      )}

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
                    {pl.organizationName && (
                      <span className="text-text-muted font-normal"> · {pl.organizationName}</span>
                    )}
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

      {canWrite && (
        <PublishModal
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          organizations={orgs.data?.organizations ?? []}
          kiosks={kiosks.data?.kiosks ?? []}
          onPublished={() => {
            setPublishOpen(false);
            setToast({ message: 'New rates published', tone: 'success' });
            lists.reload();
            info.reload();
          }}
        />
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function PublishModal({
  open, onClose, organizations, kiosks, onPublished,
}: {
  open: boolean;
  onClose: () => void;
  organizations: OrganizationRow[];
  kiosks: KioskRow[];
  onPublished: () => void;
}) {
  const [scope, setScope] = React.useState<'platform' | 'organization' | 'kiosk'>('organization');
  const [organizationId, setOrganizationId] = React.useState('');
  const [kioskId, setKioskId] = React.useState('');
  const [bw, setBw] = React.useState('2.00');
  const [color, setColor] = React.useState('5.00');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) { setError(null); setOrganizationId(organizations[0]?.id ?? ''); setKioskId(''); }
  }, [open, organizations]);

  const scopedKiosks = kiosks.filter((k) => k.organizationId === organizationId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/pricing/lists', {
        organizationId: scope === 'platform' ? undefined : organizationId,
        kioskId: scope === 'kiosk' ? kioskId : undefined,
        bwPerPage: Number(bw),
        colorPerPage: Number(color),
      });
      onPublished();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not publish');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Publish new rates" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        <Field
          label="Applies to"
          htmlFor="scope"
          hint="A QR point rate overrides its partner, which overrides the platform default."
        >
          <select id="scope" value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)} className={inputClass}>
            <option value="platform">All partners (platform default)</option>
            <option value="organization">One organization</option>
            <option value="kiosk">One QR point</option>
          </select>
        </Field>

        {scope !== 'platform' && (
          <Field label="Organization" htmlFor="pl-org">
            <select id="pl-org" required value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)} className={inputClass}>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </Field>
        )}

        {scope === 'kiosk' && (
          <Field label="QR point" htmlFor="pl-kiosk">
            <select id="pl-kiosk" required value={kioskId}
              onChange={(e) => setKioskId(e.target.value)} className={inputClass}>
              <option value="">Select a QR point…</option>
              {scopedKiosks.map((k) => (
                <option key={k.id} value={k.id}>{k.kioskId} - {k.name}</option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="B/W per page (₹)" htmlFor="pl-bw">
            <input id="pl-bw" type="number" step="0.01" min="0" required value={bw}
              onChange={(e) => setBw(e.target.value)} className={inputClass} inputMode="decimal" />
          </Field>
          <Field label="Colour per page (₹)" htmlFor="pl-color">
            <input id="pl-color" type="number" step="0.01" min="0" required value={color}
              onChange={(e) => setColor(e.target.value)} className={inputClass} inputMode="decimal" />
          </Field>
        </div>

        <p className="text-xs text-text-muted">
          Takes effect immediately for new quotes. Jobs already priced keep the rate they were
          quoted - existing customers are never re-charged.
        </p>

        <div className="flex gap-2">
          <Button type="submit" loading={saving} className="flex-1">Publish</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
