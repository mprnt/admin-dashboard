'use client';

import React from 'react';
import type { Period } from '@/lib/api';
import { Icon } from '@/components/Icon';

const OPTIONS: { value: Period; label: string; short: string }[] = [
  { value: 'day', label: 'Today', short: 'Day' },
  { value: 'week', label: 'This week', short: 'Week' },
  { value: 'month', label: 'This month', short: 'Month' },
  { value: 'year', label: 'This year', short: 'Year' },
];

/**
 * Period selector, rendered as a radio group rather than a row of buttons so
 * arrow keys move between options and screen readers announce the selection -
 * which is what this control actually is.
 */
export function PeriodFilter({
  value,
  onChange,
  timezone,
}: {
  value: Period;
  onChange: (p: Period) => void;
  timezone?: string;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div
        role="radiogroup"
        aria-label="Reporting period"
        className="inline-flex bg-text/[0.05] rounded-xl p-1 max-w-full"
      >
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all min-h-[34px] ${
                active
                  ? 'bg-surface text-text shadow-raised'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <span className="hidden xs:inline">{opt.label}</span>
              <span className="xs:hidden">{opt.short}</span>
            </button>
          );
        })}
      </div>

      {timezone && (
        <p className="text-xs text-text-muted flex items-center gap-1">
          <Icon name="clock" className="w-3.5 h-3.5" />
          <span className="font-medium">{timezone}</span>
        </p>
      )}
    </div>
  );
}
