'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { buildQuery, type LeadPage } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { Card, CardHeader, Button, EmptyState, ErrorState, SkeletonRows } from '@/components/ui';
import { Icon } from '@/components/Icon';

const PAGE_SIZE = 20;

/**
 * Contact-form submissions from the marketing site. Super admin only; leads
 * belong to the platform, not to any one shop, so the shop switcher is ignored.
 */
export default function LeadsPage() {
  const [offset, setOffset] = React.useState(0);
  const { data, error, loading, reload } = useApi<LeadPage>(
    `/leads${buildQuery({ limit: PAGE_SIZE, offset })}`,
    [],
    { unscoped: true }
  );

  const total = data?.pagination.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Leads</h1>
        <p className="text-sm text-text-muted mt-1.5">
          People who asked to hear from MPrnt through the website
        </p>
      </div>

      <Card>
        <CardHeader title={loading ? 'Loading…' : `${total} ${total === 1 ? 'lead' : 'leads'}`} />

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <SkeletonRows rows={4} />
        ) : data && data.leads.length > 0 ? (
          <ul className="divide-y divide-border">
            {data.leads.map((lead) => (
              <li key={lead.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text truncate">
                      {lead.name}
                      {lead.company && (
                        <span className="text-text-muted font-normal"> · {lead.company}</span>
                      )}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5 flex flex-wrap gap-x-3">
                      <a href={`mailto:${lead.email}`} className="hover:text-text underline-offset-2 hover:underline">
                        {lead.email}
                      </a>
                      {lead.phone && <span>{lead.phone}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 text-xs text-text-muted">
                    <p>{dateTime(lead.createdAt)}</p>
                    <p className="mt-0.5">{lead.source}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-text whitespace-pre-line break-words">
                  {lead.message}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No leads yet"
            message="Contact-form submissions from the website will show up here."
            icon={<Icon name="inbox" className="w-6 h-6" />}
          />
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 p-4 border-t border-border text-sm text-text-muted">
            <span>
              {from}-{to} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0 || loading}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
