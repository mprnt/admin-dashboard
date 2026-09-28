'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { buildQuery, type AuditRow } from '@/lib/api';
import { dateTime, titleCase } from '@/lib/format';
import { Card, CardHeader, EmptyState, ErrorState, SkeletonRows, Button } from '@/components/ui';
import { Icon } from '@/components/Icon';

const PAGE_SIZE = 50;

/** Tone by action family, so destructive events stand out when scanning. */
function toneFor(action: string): string {
  if (/deleted|suspended|revoked|failed/.test(action)) return 'text-error';
  if (/created|published|active/.test(action)) return 'text-success';
  if (/password|permission|reset/.test(action)) return 'text-warning';
  return 'text-text-muted';
}

export default function AuditPage() {
  const [page, setPage] = React.useState(0);

  const { data, error, loading, reload } = useApi<{ total: number; entries: AuditRow[] }>(
    `/audit${buildQuery({ limit: PAGE_SIZE, offset: page * PAGE_SIZE })}`,
    [page]
  );

  const pages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text">Audit log</h1>
        <p className="text-sm text-text-muted">
          Every administrative change, who made it and when
        </p>
      </div>

      <Card>
        <CardHeader title={loading ? 'Loading…' : `${data?.total ?? 0} entries`} />

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <SkeletonRows rows={6} />
        ) : data && data.entries.length > 0 ? (
          <>
            <ul className="divide-y divide-border">
              {data.entries.map((entry) => (
                <li key={entry.id} className="p-4 flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-current ${toneFor(entry.action)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text">{titleCase(entry.action)}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {entry.actor ? entry.actor.name || entry.actor.email : 'system'}
                      {' · '}
                      {dateTime(entry.createdAt)}
                      {entry.ipAddress && ` · ${entry.ipAddress}`}
                    </p>
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <p className="text-xs text-text-muted mt-1 font-mono break-all">
                        {Object.entries(entry.details)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {pages > 1 && (
              <nav aria-label="Pagination" className="flex items-center justify-between gap-3 p-4 border-t border-border">
                <Button variant="secondary" size="sm" disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Previous
                </Button>
                <p className="text-sm text-text-muted tabular" aria-live="polite">
                  Page {page + 1} of {pages}
                </p>
                <Button variant="secondary" size="sm" disabled={page >= pages - 1}
                  onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </nav>
            )}
          </>
        ) : (
          <EmptyState title="No audit entries yet" icon={<Icon name="shield" className="w-6 h-6" />} />
        )}
      </Card>
    </div>
  );
}
