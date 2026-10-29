'use client';

import React from 'react';
import { Icon } from '@/components/Icon';

/**
 * Page numbers for a list the server sends one page at a time. Shows the first
 * and last page, the pages either side of the current one, and gaps between,
 * so it stays short however long the list grows.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  label = 'Pages',
}: {
  /** Zero-based. */
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  label?: string;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  const first = page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);

  const shown = new Set([0, pages - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < pages));
  const items: Array<number | 'gap'> = [];
  [...shown]
    .sort((a, b) => a - b)
    .forEach((p, i, arr) => {
      if (i > 0 && p - arr[i - 1]! > 1) items.push('gap');
      items.push(p);
    });

  const arrow =
    'flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-surface text-text transition-colors hover:bg-surface-secondary disabled:pointer-events-none disabled:opacity-40';

  return (
    <nav aria-label={label} className="flex flex-col items-center gap-3 border-t border-border p-4 sm:flex-row sm:justify-between">
      <p className="text-sm text-text-muted tabular" aria-live="polite">
        Showing {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <button type="button" className={arrow} disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
        </button>
        {items.map((item, i) =>
          item === 'gap' ? (
            <span key={`gap-${i}`} className="w-6 text-center text-text-muted" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              aria-label={`Page ${item + 1}`}
              aria-current={item === page ? 'page' : undefined}
              className={`h-11 min-w-[44px] rounded-full px-3 text-sm font-semibold tabular transition-colors ${
                item === page ? 'bg-primary text-white' : 'text-text hover:bg-surface-secondary'
              }`}
            >
              {item + 1}
            </button>
          )
        )}
        <button
          type="button"
          className={arrow}
          disabled={page >= pages - 1}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
