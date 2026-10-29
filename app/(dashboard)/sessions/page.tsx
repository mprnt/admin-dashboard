'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { buildQuery, type Period, type Range, type SessionRow } from '@/lib/api';
import { currency, dateTime, duration, number } from '@/lib/format';
import { jobState, plural, printSummary } from '@/lib/plain';
import { Button, Card, CardHeader, EmptyState, ErrorState, SkeletonRows, PageHeader } from '@/components/ui';
import { Callout, StateBadge, TechnicalDetails } from '@/components/Plain';
import { PeriodFilter } from '@/components/PeriodFilter';
import { Pagination } from '@/components/Pagination';
import { LIST_BODY, LIST_CARD, LIST_PAGE, scrollListToTop } from '@/components/ListLayout';
import { Icon } from '@/components/Icon';
import { useProfile } from '@/lib/useProfile';

const PAGE_SIZE = 10;

/** The filters a shop owner actually wants, in their words. */
const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All jobs' },
  { value: 'completed', label: 'Printed' },
  { value: 'failed', label: 'Could not print' },
  { value: 'queued', label: 'Waiting' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function SessionsPage() {
  const profile = useProfile();
  const [period, setPeriod] = React.useState<Period>('month');
  const [filter, setFilter] = React.useState('');
  const [page, setPage] = React.useState(0);

  React.useEffect(() => setPage(0), [period, filter]);

  const query = buildQuery({
    period,
    status: filter || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const { data, error, loading, reload } = useApi<{
    range: Range;
    total: number;
    sessions: SessionRow[];
  }>(`/reports/sessions${query}`);

  const canExport = profile?.permissions.includes('export:data');
  const total = data?.total ?? 0;
  const listRef = React.useRef<HTMLDivElement>(null);
  const goTo = (next: number) => {
    setPage(next);
    scrollListToTop(listRef.current);
  };

  function exportCsv() {
    // Goes through the proxy so the token is attached server-side; the browser
    // just follows the download.
    window.location.href = `/api/proxy/admin/reports/sessions/export${buildQuery({ period })}`;
  }

  return (
    <div className={LIST_PAGE}>
      <PageHeader
        title="Print history"
        subtitle="Every job customers paid for, and what happened to it."
        actions={
          canExport ? (
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Icon name="download" className="h-4 w-4" />
              Download as spreadsheet
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <PeriodFilter value={period} onChange={setPeriod} timezone={data?.range.timezone} />

        <div role="group" aria-label="Show jobs" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'border-primary bg-primary text-white'
                  : 'border-border/70 bg-surface text-text hover:bg-surface-secondary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Callout tone="neutral" title="Customer documents are never shown here">
        You see what was printed and what it cost, not what the document said.
      </Callout>

      <Card className={LIST_CARD}>
        <CardHeader
          title={loading ? 'Loading…' : `${number(total)} ${total === 1 ? 'job' : 'jobs'}`}
          subtitle={data ? `${data.range.from} to ${data.range.to}` : undefined}
        />

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <SkeletonRows rows={5} />
        ) : data && data.sessions.length > 0 ? (
          <>
            <div ref={listRef} className={LIST_BODY}>
              <ul className="divide-y divide-border">
                {data.sessions.map((row) => (
                  <JobRow key={row.jobId} row={row} />
                ))}
              </ul>
            </div>

            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={goTo} label="Print history pages" />
          </>
        ) : (
          <EmptyState
            title="No jobs here"
            message={filter ? 'No jobs match this filter in the period. Try All jobs, or a wider period.' : 'No jobs in this period yet. Try a wider period.'}
            icon={<Icon name="inbox" className="h-6 w-6" />}
          />
        )}
      </Card>
    </div>
  );
}

/** One job, read top to bottom: what happened, what it cost, where and when. */
function JobRow({ row }: { row: SessionRow }) {
  const state = jobState(row);
  const printed = row.pages.printed;
  const sheets = row.pages.sheets;

  return (
    <li className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-text tabular">
            {currency(row.amount)}
            <span className="font-normal text-text-muted">
              {' '}· {plural(sheets, 'page')}
            </span>
          </p>
          <p className="mt-0.5 text-sm text-text-muted">
            {row.kiosk.name} · {dateTime(row.createdAt)}
          </p>
        </div>
        <StateBadge label={state.label} tone={state.tone} />
      </div>

      <p className="mt-2 text-sm text-text-muted">
        {printSummary(row.settings)}
        {row.printer ? ` · printed on ${row.printer.name}` : ''}
        {row.durationSeconds !== null ? ` · took ${duration(row.durationSeconds)}` : ''}
      </p>
      {printed < sheets && row.paymentStatus === 'paid' && (
        <p className="mt-1 text-sm text-text-muted">
          {printed} of {sheets} pages printed.
        </p>
      )}

      {row.errorMessage && (
        <div className="mt-2 text-sm">
          <p className="text-error">What went wrong: {row.errorMessage}</p>
          <p className="mt-0.5 text-text-muted">If this keeps happening, contact MPRNT.</p>
        </div>
      )}

      <div className="mt-2">
        <TechnicalDetails>
          <p>Job ID: {row.jobId}</p>
          {row.sessionCode && <p>Session code: {row.sessionCode}</p>}
        </TechnicalDetails>
      </div>
    </li>
  );
}
