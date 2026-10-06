'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { useScope } from '@/lib/scope';
import type { OrganizationRow } from '@/lib/api';
import { Icon } from '@/components/Icon';

/**
 * Super admin shop switcher.
 *
 * A native <select> rather than a custom dropdown: it is fully keyboard and
 * screen-reader accessible without extra work, and on a phone it opens the
 * platform's own picker, which beats anything hand-built at that size.
 */
export function OrgSwitcher() {
  const { org, setOrg } = useScope();
  const { data } = useApi<{ organizations: OrganizationRow[] }>('/organizations', [], {
    unscoped: true,
  });

  const orgs = data?.organizations ?? [];

  // If the remembered shop has since been deleted, fall back to all shops
  // rather than silently filtering everything to nothing.
  React.useEffect(() => {
    if (org && data && !orgs.some((o) => o.id === org.id)) setOrg(null);
  }, [org, data, orgs, setOrg]);

  return (
    <div className="relative">
      <label htmlFor="org-switcher" className="sr-only">
        Viewing shop
      </label>
      <Icon
        name="building"
        className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
      <select
        id="org-switcher"
        value={org?.id ?? ''}
        onChange={(e) => {
          const picked = orgs.find((o) => o.id === e.target.value);
          setOrg(picked ? { id: picked.id, name: picked.name } : null);
        }}
        className={`appearance-none pl-8 pr-8 py-1.5 min-h-[36px] max-w-[11rem] sm:max-w-[16rem] truncate
          rounded-full border text-[13px] font-medium transition-colors shadow-card
          ${org ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border bg-surface text-text hover:border-text-muted/40'}`}
      >
        <option value="">All shops</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.status === 'suspended' ? ' (suspended)' : ''}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

/**
 * Shown under the header whenever the super admin is scoped to one shop, so it
 * is never ambiguous whether a figure is one shop's or the whole platform's.
 */
export function ScopeBanner() {
  const { org, setOrg } = useScope();
  if (!org) return null;

  return (
    <div
      role="status"
      className="lg:pl-sidebar text-sm"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-accent/10 px-3.5 py-1.5">
        <p className="text-text min-w-0 truncate flex items-center gap-2">
          <Icon name="building" className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="truncate">
            Viewing <span className="font-semibold">{org.name}</span> only
          </span>
        </p>
        <button
          onClick={() => setOrg(null)}
          className="flex-shrink-0 font-medium text-accent hover:underline min-h-[32px]"
        >
          Show all shops
        </button>
        </div>
      </div>
    </div>
  );
}
