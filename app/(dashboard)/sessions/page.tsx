'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { buildQuery, type Period, type Range, type SessionRow } from '@/lib/api';
import { currency, dateTime, duration, number } from '@/lib/format';
import {
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  ErrorState,
  SkeletonRows,
  Button,
  inputClass,
} from '@/components/ui';
import { PeriodFilter } from '@/components/PeriodFilter';
import { Icon } from '@/components/Icon';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { useProfile } from '@/lib/useProfile';

const PAGE_SIZE = 25;

const STATUSES = ['', 'completed', 'failed', 'queued', 'printing', 'pending', 'cancelled'];

export default function SessionsPage() {
  const profile = useProfile();
  const [period, setPeriod] = React.useState<Period>('month');
  const [status, setStatus] = React.useState('');
  const [page, setPage] = React.useState(0);

  React.useEffect(() => setPage(0), [period, status]);

  const query = buildQuery({
    period,
    status: status || undefined,
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
  const pages = Math.ceil(total / PAGE_SIZE);

  function exportCsv() {
    // Goes through the proxy so the token is attached server-side; the browser
    // just follows the download.
    window.location.href = `/api/proxy/admin/reports/sessions/export${buildQuery({ period })}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Sessions</h1>
          <p className="text-sm text-text-muted mt-1.5">
            Every print job, what it cost and whether it printed
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrgSwitcher />
          {canExport && (
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Icon name="download" className="w-4 h-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <PeriodFilter value={period} onChange={setPeriod} timezone={data?.range.timezone} />

        <div className="sm:ml-auto">
          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`${inputClass} sm:w-44`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* A short note on why the document itself isn't here - otherwise the
          first question a shop owner asks is "where's the file?". */}
      <p className="text-xs text-text-muted flex items-start gap-2">
        <Icon name="shield" className="w-4 h-4 flex-shrink-0 mt-px" />
        Customer documents are never shown here. You see what was printed and what it cost,
        not what it contained.
      </p>

      <Card>
        <CardHeader
          title={loading ? 'Loading…' : `${number(total)} job${total === 1 ? '' : 's'}`}
          subtitle={data ? `${data.range.from} to ${data.range.to}` : undefined}
        />

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <SkeletonRows rows={6} />
        ) : data && data.sessions.length > 0 ? (
          <>
            {/* Desktop: a real table, which is the right structure for this data
                and lets screen readers announce row/column relationships. */}
            <div className="hidden md:block scroll-x">
              <table className="w-full text-sm">
                <caption className="sr-only">Print jobs for the selected period</caption>
                <thead>
                  <tr className="text-left text-text-muted bg-surface-secondary/70 border-y border-border/70">
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5">When</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5">QR point</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5">Print</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5">Printer</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5 text-right">Pages</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5 text-right">Amount</th>
                    <th scope="col" className="text-[11px] font-semibold uppercase tracking-wider px-5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.sessions.map((row) => (
                    <tr key={row.jobId} className="hover:bg-surface-secondary/70 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="text-text">{dateTime(row.createdAt)}</div>
                        {row.durationSeconds !== null && (
                          <div className="text-xs text-text-muted">
                            took {duration(row.durationSeconds)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-text">{row.kiosk.code}</div>
                        <div className="text-xs text-text-muted truncate max-w-[10rem]">
                          {row.kiosk.name}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <PrintSpec row={row} />
                      </td>
                      <td className="px-5 py-3 text-text-muted">
                        {row.printer?.name ?? '-'}
                      </td>
                      <td className="px-5 py-3 text-right tabular text-text">
                        {row.pages.printed}/{row.pages.sheets}
                      </td>
                      <td className="px-5 py-3 text-right tabular font-semibold text-text">
                        {currency(row.amount)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusPill status={row.status} />
                          {row.paymentStatus !== 'paid' && (
                            <StatusPill status={row.paymentStatus} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards. A 7-column table on a 375px screen is unreadable
                however much you scroll it. */}
            <ul className="md:hidden divide-y divide-border">
              {data.sessions.map((row) => (
                <li key={row.jobId} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-text">{dateTime(row.createdAt)}</p>
                      <p className="text-xs text-text-muted truncate">
                        {row.kiosk.code} · {row.printer?.name ?? 'unassigned'}
                      </p>
                    </div>
                    <p className="font-bold text-text tabular flex-shrink-0">
                      {currency(row.amount)}
                    </p>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    <StatusPill status={row.status} />
                    {row.paymentStatus !== 'paid' && <StatusPill status={row.paymentStatus} />}
                    <span className="text-xs text-text-muted tabular">
                      {row.pages.printed}/{row.pages.sheets} pages
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-text-muted">
                    <PrintSpec row={row} />
                  </div>

                  {row.errorMessage && (
                    <p className="mt-2 text-xs text-error">{row.errorMessage}</p>
                  )}
                </li>
              ))}
            </ul>

            {pages > 1 && (
              <nav
                aria-label="Pagination"
                className="flex items-center justify-between gap-3 p-4 border-t border-border"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <p className="text-sm text-text-muted tabular" aria-live="polite">
                  Page {page + 1} of {pages}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= pages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        ) : (
          <EmptyState
            title="No jobs in this period"
            message="Try a wider date range, or clear the status filter."
            icon={<Icon name="inbox" className="w-6 h-6" />}
          />
        )}
      </Card>
    </div>
  );
}

function PrintSpec({ row }: { row: SessionRow }) {
  const sides = row.settings.printSides === 'double' ? 'Double' : 'Single';
  return (
    <span className="text-text-muted">
      {row.settings.colorMode === 'color' ? 'Colour' : 'B/W'}
      {' · '}
      <span className="lg:hidden">{sides}</span>
      <span className="hidden lg:inline">{sides}-sided</span>
      {row.settings.copies > 1 && ` · ${row.settings.copies}×`}
    </span>
  );
}
