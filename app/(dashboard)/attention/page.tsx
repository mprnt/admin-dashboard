'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import type { AttentionRow } from '@/lib/api';
import { currency, relativeAge, dateTime } from '@/lib/format';
import { Card, CardHeader, StatusPill, EmptyState, ErrorState, SkeletonRows } from '@/components/ui';
import { Icon } from '@/components/Icon';

/**
 * Paid jobs that have not printed.
 *
 * This is the page that costs money when nobody looks at it: every row is a
 * customer who has been charged and has nothing to show for it.
 */
export default function AttentionPage() {
  const { data, error, loading, reload } = useApi<{ count: number; jobs: AttentionRow[] }>(
    '/attention'
  );

  const refundCandidates = data?.jobs.filter((j) => j.refundCandidate).length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text">Needs attention</h1>
        <p className="text-sm text-text-muted">
          Jobs that were paid for but have not finished printing
        </p>
      </div>

      {refundCandidates > 0 && (
        <Card className="p-4 border-warning/40 bg-warning/5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="w-9 h-9 rounded-lg bg-warning/15 text-warning flex items-center justify-center flex-shrink-0"
            >
              <Icon name="clock" className="w-5 h-5" />
            </span>
            <div>
              <p className="font-bold text-text">
                {refundCandidates} {refundCandidates === 1 ? 'job has' : 'jobs have'} been waiting
                over an hour
              </p>
              <p className="text-sm text-text-muted mt-0.5">
                These are unlikely to print on their own. Consider refunding the customer.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title={loading ? 'Loading…' : `${data?.count ?? 0} waiting`} />

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <SkeletonRows rows={3} />
        ) : data && data.jobs.length > 0 ? (
          <ul className="divide-y divide-border">
            {data.jobs.map((job) => (
              <li key={job.jobId} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text">
                      {currency(job.amount)}
                      <span className="text-text-muted font-normal"> · {job.kiosk.code}</span>
                    </p>
                    <p className="text-xs text-text-muted font-mono truncate mt-0.5">
                      {job.jobId}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <StatusPill status={job.queueStatus || job.status} />
                    <p
                      className={`text-xs mt-1 ${
                        job.refundCandidate ? 'text-warning font-semibold' : 'text-text-muted'
                      }`}
                    >
                      {relativeAge(job.ageSeconds)}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                  <span>Paid {dateTime(job.createdAt)}</span>
                  {job.retryCount > 0 && <span>{job.retryCount} retries</span>}
                  {job.errorCode && (
                    <span className="text-error font-medium">{job.errorCode}</span>
                  )}
                </div>

                {job.errorMessage && (
                  <p className="mt-1.5 text-xs text-error">{job.errorMessage}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nothing waiting"
            message="Every paid job has printed. This is what you want to see."
            icon={<Icon name="check" className="w-6 h-6" />}
          />
        )}
      </Card>
    </div>
  );
}
