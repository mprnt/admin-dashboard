'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { useProfile } from '@/lib/useProfile';
import { useScope } from '@/lib/scope';
import { buildQuery, type AuditRow } from '@/lib/api';
import { dateTime, titleCase } from '@/lib/format';
import { Card, CardHeader, EmptyState, ErrorState, SkeletonRows, Button } from '@/components/ui';
import { Icon } from '@/components/Icon';

const PAGE_SIZE = 50;

type Category = 'all' | 'security';
type Who = 'everyone' | 'platform' | 'shop';

/** Tone by action family, so destructive events stand out when scanning. */
function toneFor(action: string): string {
  if (/deleted|suspended|revoked|failed|locked/.test(action)) return 'text-error';
  if (/created|published|enrolled|active/.test(action)) return 'text-success';
  if (/password|permission|reset|rotated/.test(action)) return 'text-warning';
  return 'text-text-muted';
}

const REASON: Record<string, string> = {
  bad_password: 'wrong password',
  unknown_account: 'no such account',
  account_locked: 'account was locked',
};

/**
 * Two audiences read this page, and the backend decides what each sees:
 *
 *  - A shop sees only what its own staff did. Actions taken by MPrnt are not
 *    returned to them at all.
 *  - The platform sees everything, and can narrow by who acted, by shop (via
 *    the switcher) and by action.
 *
 * The filters here are conveniences. None of them can widen a shop's view:
 * the backend ignores platform-only parameters from shop staff.
 */
export default function AuditPage() {
  const profile = useProfile();
  const { org } = useScope();
  const isSuper = profile?.role === 'super_admin';

  const [category, setCategory] = React.useState<Category>('all');
  const [who, setWho] = React.useState<Who>('everyone');
  const [action, setAction] = React.useState('');
  const [page, setPage] = React.useState(0);

  React.useEffect(() => setPage(0), [category, who, action, org?.id]);

  const { data, error, loading, reload } = useApi<{ total: number; entries: AuditRow[] }>(
    `/audit${buildQuery({
      category,
      actorScope: isSuper && who !== 'everyone' ? who : undefined,
      action: action || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })}`
  );
  const actions = useApi<{ actions: string[] }>('/audit/actions', [], { unscoped: true });

  const pages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);
  const showShop = isSuper && !org;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Audit log</h1>
        <p className="text-sm text-text-muted mt-1.5">
          {isSuper
            ? `Every administrative change${org ? ` concerning ${org.name}` : ' across all shops'}`
            : "Changes made by your shop's staff, and sign-in activity on their accounts"}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div
          role="radiogroup"
          aria-label="Log view"
          className="inline-flex bg-surface-secondary border border-border rounded-lg p-1 self-start"
        >
          {(
            [
              ['all', 'All activity'],
              ['security', 'Sign-ins & security'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="radio"
              aria-checked={category === value}
              onClick={() => setCategory(value)}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-semibold transition-colors min-h-[36px] ${
                category === value ? 'bg-surface text-accent shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 lg:ml-auto">
          {isSuper && (
            <div className="flex items-center gap-2">
              <label htmlFor="who" className="text-sm text-text-muted whitespace-nowrap">
                Done by
              </label>
              <select
                id="who"
                value={who}
                onChange={(e) => setWho(e.target.value as Who)}
                className="px-3 py-1.5 min-h-[36px] rounded-lg border border-border bg-surface text-sm text-text"
              >
                <option value="everyone">Everyone</option>
                <option value="platform">MPrnt (platform)</option>
                <option value="shop">Shop staff</option>
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label htmlFor="action" className="text-sm text-text-muted whitespace-nowrap">
              Action
            </label>
            <select
              id="action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="px-3 py-1.5 min-h-[36px] rounded-lg border border-border bg-surface text-sm text-text max-w-[14rem]"
            >
              <option value="">All actions</option>
              {(actions.data?.actions ?? []).map((a) => (
                <option key={a} value={a}>
                  {titleCase(a)}
                </option>
              ))}
            </select>
          </div>
        </div>
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
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-text">{describe(entry)}</p>
                      {isSuper && (
                        <span
                          className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${
                            entry.actorScope === 'platform'
                              ? 'border-accent/40 text-accent bg-accent/10'
                              : 'border-border text-text-muted'
                          }`}
                        >
                          {entry.actorScope === 'platform' ? 'MPrnt' : 'Shop'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {entry.actor ? (
                        <>
                          {entry.actor.name || entry.actor.email}
                          <span className="capitalize"> ({entry.actor.role.replace('_', ' ')})</span>
                        </>
                      ) : (
                        'Unknown / system'
                      )}
                      {showShop && entry.organization?.name ? ` · ${entry.organization.name}` : ''}
                      {' · '}
                      {dateTime(entry.createdAt)}
                      {entry.ipAddress && ` · ${entry.ipAddress}`}
                    </p>
                    <Details entry={entry} />
                  </div>
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
            title={category === 'security' ? 'No sign-in activity' : 'No entries'}
            message={action ? 'Try clearing the action filter.' : undefined}
            icon={<Icon name="shield" className="w-6 h-6" />}
          />
        )}
      </Card>
    </div>
  );
}

/** A readable headline for an entry. Failed sign-ins get their reason inline. */
function describe(entry: AuditRow): string {
  if (entry.action === 'admin.login_failed') {
    const reason = (entry.details?.reason as string | undefined) ?? '';
    return `Failed sign-in${REASON[reason] ? ` - ${REASON[reason]}` : ''}`;
  }
  if (entry.action === 'admin.account_locked') return 'Account locked after repeated failures';
  if (entry.action === 'admin.login') return 'Signed in';
  return titleCase(entry.action);
}

/** Remaining detail fields, minus the ones already folded into the headline. */
function Details({ entry }: { entry: AuditRow }) {
  if (!entry.details) return null;
  const skip = new Set(['reason']);
  const pairs = Object.entries(entry.details).filter(([k, v]) => !skip.has(k) && v !== null && v !== '');
  if (pairs.length === 0) return null;
  return (
    <p className="text-xs text-text-muted mt-1 font-mono break-all">
      {pairs.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')}
    </p>
  );
}
