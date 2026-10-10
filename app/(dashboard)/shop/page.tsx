'use client';

import Link from 'next/link';
import { useApi } from '@/lib/useApi';
import type { ShopProfile } from '@/lib/api';
import { currency, dateLong, number, sinceLabel } from '@/lib/format';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Stat,
  StatStrip,
  StatusPill,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ContactLine } from '@/components/ContactSupport';

/**
 * Your shop: who you are to MPrnt, how long you have been here, and what you
 * have earned since.
 *
 * Everything on this page comes from one endpoint that takes no parameters.
 * The shop is whichever one the signed-in account belongs to, worked out on
 * the server from the session, so there is nothing here that could be pointed
 * at a different shop.
 */
export default function ShopPage() {
  const { data, error, loading, reload } = useApi<ShopProfile>('/shop');

  if (error) {
    // The backend answers an endpoint it does not have with "Route <path> not
    // found". That is a rollout-order problem - this page shipped before the
    // backend that serves it - not something the shop did or can act on, so it
    // gets a plain explanation instead of a raw path. A real 404 from the
    // endpoint itself ("Shop not found") does not match and is shown as it is.
    const notRolledOut = /^Route .+ not found$/.test(error);

    return (
      <div className="space-y-6">
        <PageHeader title="Your shop" />
        <Card>
          {notRolledOut ? (
            <EmptyState
              title="Shop details are on their way"
              message="This part of the dashboard needs an update that has not reached your account yet. Everything else works as normal - check back shortly."
              icon={<Icon name="clock" className="w-6 h-6" />}
              action={
                <Button variant="secondary" size="sm" onClick={reload}>
                  Check again
                </Button>
              }
            />
          ) : (
            <ErrorState message={error} onRetry={reload} />
          )}
        </Card>
      </div>
    );
  }

  const life = data?.lifetime;
  const since = data ? sinceLabel(data.memberSince) : '';
  const fulfilment =
    life && life.paidJobs > 0 ? Math.round((life.completedJobs / life.paidJobs) * 1000) / 10 : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Your shop"
        title={loading ? 'Your shop' : data?.name ?? 'Your shop'}
        subtitle={
          data ? (
            <span className="inline-flex items-center gap-2 flex-wrap">
              <StatusPill status={data.status} />
              <span>{data.timezone}</span>
            </span>
          ) : undefined
        }
      />

      {/* Membership: the thing a shop asked to see first. */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="eyebrow">Member since</p>
            {loading ? (
              <div className="skeleton h-9 w-56 mt-2" />
            ) : (
              <p className="page-title mt-1">{dateLong(data?.memberSince ?? null, data?.timezone)}</p>
            )}
            {!loading && since && (
              <p className="text-sm text-text-muted mt-1.5">
                {since === 'today' ? 'Joined today' : `With MPrnt for ${since}`}
              </p>
            )}
          </div>

          {!loading && data && (
            <div className="sm:text-right">
              <p className="eyebrow">First sale</p>
              <p className="text-sm font-semibold text-text mt-1">
                {data.lifetime.firstSaleAt
                  ? dateLong(data.lifetime.firstSaleAt, data.timezone)
                  : 'No sales yet'}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Lifetime: everything since joining. */}
      <section aria-labelledby="lifetime-heading">
        <h2 id="lifetime-heading" className="eyebrow mb-2.5">
          Since you joined
        </h2>
        <StatStrip>
          <Stat
            bare
            label="Revenue"
            value={currency(life?.revenue ?? 0)}
            hint={life ? `${number(life.paidJobs)} paid ${life.paidJobs === 1 ? 'job' : 'jobs'}` : undefined}
            icon={<Icon name="chart" className="w-3.5 h-3.5" />}
            loading={loading}
          />
          <Stat
            bare
            label="Pages printed"
            value={number(life?.pagesPrinted ?? 0)}
            icon={<Icon name="printer" className="w-3.5 h-3.5" />}
            loading={loading}
          />
          <Stat
            bare
            label="Jobs completed"
            value={number(life?.completedJobs ?? 0)}
            hint={fulfilment !== null ? `${fulfilment}% of paid jobs` : undefined}
            icon={<Icon name="check" className="w-3.5 h-3.5" />}
            loading={loading}
          />
          <Stat
            bare
            label="Average order"
            value={
              life && life.paidJobs > 0 ? currency(life.revenue / life.paidJobs) : currency(0)
            }
            icon={<Icon name="receipt" className="w-3.5 h-3.5" />}
            loading={loading}
          />
        </StatStrip>
        <p className="text-xs text-text-muted mt-2.5">
          Revenue is what customers paid for jobs at your QR points. For this month, this week or
          a custom range, see the <Link href="/" className="text-accent hover:underline">Overview</Link>.
        </p>
      </section>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Your setup"
            subtitle="What is connected to MPrnt"
            action={
              <Link
                href="/printers"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline min-h-[32px]"
              >
                View printers
                <Icon name="arrowRight" className="w-3.5 h-3.5" />
              </Link>
            }
          />
          <dl className="px-4 pb-4 sm:px-5 sm:pb-5 grid grid-cols-3 gap-3">
            <Fact label="QR points" value={data?.fleet.qrPoints} loading={loading} />
            <Fact label="Printers" value={data?.fleet.printers} loading={loading} />
            <Fact label="Stations" value={data?.fleet.stations} loading={loading} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Details on file" subtitle="How MPrnt reaches you" />
          <dl className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-3 text-sm">
            <Detail label="Email" value={data?.contactEmail} loading={loading} />
            <Detail label="Phone" value={data?.contactPhone} loading={loading} />
            <Detail label="Timezone" value={data?.timezone} loading={loading} />
          </dl>
        </Card>
      </div>

      <ContactLine subject="Update my shop details">
        Something here out of date, or need a change? Contact MPrnt:
      </ContactLine>
    </div>
  );
}

function Fact({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface-secondary/70 p-3">
      <dt className="text-xs text-text-muted">{label}</dt>
      {loading ? (
        <dd className="skeleton h-7 w-10 mt-1.5" />
      ) : (
        <dd className="text-2xl font-semibold text-text tabular mt-0.5">{number(value ?? 0)}</dd>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | null | undefined;
  loading: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      {loading ? (
        <dd className="skeleton h-5 w-40" />
      ) : (
        <dd className={`font-medium text-right break-all ${value ? 'text-text' : 'text-text-muted'}`}>
          {value || 'Not provided'}
        </dd>
      )}
    </div>
  );
}
