'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import type { AttentionRow } from '@/lib/api';
import { currency, dateTime, relativeAge } from '@/lib/format';
import { jobState, plural } from '@/lib/plain';
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonRows } from '@/components/ui';
import { Callout, StateBadge, TechnicalDetails } from '@/components/Plain';
import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import { LIST_BODY, LIST_CARD, LIST_PAGE, scrollListToTop } from '@/components/ListLayout';

const PAGE_SIZE = 10;
import { ContactLine } from '@/components/ContactSupport';

/**
 * Paid jobs that have not printed.
 *
 * Every row is a customer who has paid and has nothing to show for it, so each
 * one says what happened and what happens next. Refunds are issued by MPRNT, not
 * from here, so an old job carries a ready message to MPRNT rather than a button.
 */
export default function AttentionPage() {
  const { data, error, loading, reload } = useApi<{ count: number; jobs: AttentionRow[] }>('/attention');

  const jobs = data?.jobs ?? [];
  const refundCandidates = jobs.filter((j) => j.refundCandidate);
  const waitingCount = jobs.length - refundCandidates.length;

  // The queue comes back whole, so the pages are cut here.
  const [page, setPage] = React.useState(0);
  const pages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = jobs.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const listRef = React.useRef<HTMLDivElement>(null);
  const goTo = (next: number) => {
    setPage(next);
    scrollListToTop(listRef.current);
  };

  return (
    <div className={LIST_PAGE}>
      <PageHeader
        title="Needs you"
        subtitle="Customers paid, but their print has not come out yet."
      />

      {!loading && !error && (
        refundCandidates.length > 0 ? (
          <Callout tone="warn" title={`${plural(refundCandidates.length, 'customer')} waiting over an hour`}>
            <p>These will not print on their own. Ask MPRNT to refund them.</p>
            <ContactLine
              className="mt-2"
              subject={`Refunds for ${plural(refundCandidates.length, 'waiting job')}`}
              body={refundCandidates
                .map((j) => `Job ID: ${j.jobId}\nQR point: ${j.kiosk.code}\nAmount: ${currency(j.amount)}\nPaid: ${dateTime(j.createdAt)}`)
                .join('\n\n')}
            >
              Contact MPRNT and they will refund them:
            </ContactLine>
          </Callout>
        ) : waitingCount > 0 ? (
          <Callout tone="neutral" title={`${plural(waitingCount, 'paid job')} waiting for a printer`}>
            They will print when a printer is free. Nothing for you to do yet. If one waits over an hour, it will
            show here as a refund to ask for.
          </Callout>
        ) : (
          <Callout tone="good" title="Nothing needs you">
            Every paid job has printed.
          </Callout>
        )
      )}

      <Card className={LIST_CARD}>
        <CardHeader title={loading ? 'Loading…' : `${plural(jobs.length, 'job')} waiting`} />

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <SkeletonRows rows={3} />
        ) : jobs.length > 0 ? (
          <>
            <div ref={listRef} className={LIST_BODY}>
              <ul className="divide-y divide-border">
                {visible.map((job) => (
                  <AttentionItem key={job.jobId} job={job} />
                ))}
              </ul>
            </div>
            <Pagination
              page={current}
              pageSize={PAGE_SIZE}
              total={jobs.length}
              onChange={goTo}
              label="Needs you pages"
            />
          </>
        ) : (
          <EmptyState
            title="Nothing waiting"
            message="When a customer has paid and the print is stuck, it will show here."
            icon={<Icon name="check" className="h-6 w-6" />}
          />
        )}
      </Card>
    </div>
  );
}

function AttentionItem({ job }: { job: AttentionRow }) {
  const state = jobState(job);
  return (
    <li className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-text tabular">
            {currency(job.amount)} paid at {job.kiosk.name}
          </p>
          <p className="mt-0.5 text-sm text-text-muted">
            {dateTime(job.createdAt)} · Paid {relativeAge(job.ageSeconds)}
          </p>
        </div>
        <StateBadge label={state.label} tone={state.tone} />
      </div>

      <p className="mt-2 text-sm text-text-muted">{state.detail}</p>
      {job.errorMessage && <p className="mt-1 text-sm text-error">What went wrong: {job.errorMessage}</p>}

      <div className="mt-3">
        {job.refundCandidate ? (
          <div className="rounded-xl bg-warning/5 px-3 py-2.5">
            <p className="text-sm font-semibold text-text">Next step: ask MPRNT to refund this customer.</p>
            <ContactLine
              className="mt-1"
              subject={`Refund request: job ${job.jobId}`}
              body={`Job ID: ${job.jobId}\nQR point: ${job.kiosk.code}\nAmount: ${currency(job.amount)}\nPaid: ${dateTime(job.createdAt)}\n\nPlease refund this customer.`}
            >
              Contact MPRNT:
            </ContactLine>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            Nothing to do yet. The system keeps trying. If it is still here after an hour, it will appear as a
            refund to ask MPRNT for.
          </p>
        )}
      </div>

      <div className="mt-2">
        <TechnicalDetails>
          <p>Job ID: {job.jobId}</p>
          {job.errorCode && <p>Error code: {job.errorCode}</p>}
          {job.retryCount > 0 && <p>Tried again {job.retryCount} times</p>}
        </TechnicalDetails>
      </div>
    </li>
  );
}
