import React from 'react';
import { Icon } from '@/components/Icon';
import type { Tone } from '@/lib/plain';

const BADGE: Record<Tone, string> = {
  good: 'bg-success/10 text-success',
  warn: 'bg-warning/12 text-warning',
  bad: 'bg-error/10 text-error',
  info: 'bg-info/10 text-info',
  neutral: 'bg-text-muted/10 text-text-muted',
};

const CALLOUT: Record<Tone, string> = {
  good: 'border-success/30 bg-success/5',
  warn: 'border-warning/40 bg-warning/5',
  bad: 'border-error/35 bg-error/5',
  info: 'border-info/30 bg-info/5',
  neutral: 'border-border bg-surface-secondary/60',
};

const ICON: Record<Tone, React.ComponentProps<typeof Icon>['name']> = {
  good: 'check',
  warn: 'alert',
  bad: 'alert',
  info: 'printer',
  neutral: 'inbox',
};

/**
 * A status as a word with a dot. The word carries the meaning, so colour is
 * never the only signal.
 */
export function StateBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[tone]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/**
 * One plain sentence about what to do, with the reason. Used where a shop owner
 * needs to act, so the next step is written out rather than implied.
 */
export function Callout({
  tone,
  title,
  children,
  className = '',
}: {
  tone: Tone;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${CALLOUT[tone]} ${className}`}>
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${BADGE[tone]}`}
      >
        <Icon name={ICON[tone]} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-text">{title}</p>
        {children && <div className="mt-1 text-sm text-text-muted">{children}</div>}
      </div>
    </div>
  );
}

/** Ids and codes, kept out of the way for the people who need them. */
export function TechnicalDetails({ children }: { children: React.ReactNode }) {
  return (
    <details className="group text-xs text-text-muted">
      <summary className="inline-flex min-h-[44px] cursor-pointer items-center font-medium text-accent hover:underline">
        Technical details
      </summary>
      <div className="mt-1 space-y-1 break-all font-mono">{children}</div>
    </details>
  );
}
