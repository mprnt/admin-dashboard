'use client';

import React from 'react';

/**
 * Shared primitives, styled to match mprnt-qr: semantic colour tokens,
 * rounded-xl surfaces, generous touch targets.
 *
 * Two rules run through all of these:
 *  - every interactive element is at least 44px tall on touch screens, which is
 *    the minimum reliable tap target;
 *  - state is never signalled by colour alone - each status carries a label or
 *    icon too, so it survives colour blindness and greyscale.
 */

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Tag
      // A caller's own background or border colour (e.g. a warning callout)
      // replaces the default rather than competing with it in CSS order.
      className={`${/(^|\s)bg-/.test(className) ? '' : 'bg-surface'} border ${
        /(^|\s)border-(error|warning|success|info|accent|primary)/.test(className) ? '' : 'border-border/70'
      } rounded-2xl shadow-card ${className}`}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-text truncate">{title}</h2>
        {subtitle && <p className="text-xs sm:text-[13px] text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
      'bg-primary text-white hover:bg-primary-dark border-primary-dark/40 shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_0_0/0.12)]',
    secondary: 'bg-surface text-text hover:bg-surface-secondary border-border shadow-card',
    ghost: 'bg-transparent text-text-muted hover:text-text hover:bg-text/5 border-transparent',
    danger: 'bg-error text-white hover:opacity-90 border-error',
  };

  const sizes: Record<string, string> = {
    // min-h keeps the tap target usable even when the label is short.
    sm: 'text-[13px] px-3 py-1.5 min-h-[38px]',
    md: 'text-sm px-4 py-2.5 min-h-[44px]',
  };

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border font-medium
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
        />
      )}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

const STATUS_TONE: Record<string, string> = {
  completed: 'bg-success/10 text-success',
  active: 'bg-success/10 text-success',
  online: 'bg-success/10 text-success',
  paid: 'bg-success/10 text-success',
  printing: 'bg-info/10 text-info',
  assigned: 'bg-info/10 text-info',
  queued: 'bg-warning/10 text-warning',
  pending: 'bg-warning/10 text-warning',
  busy: 'bg-warning/10 text-warning',
  failed: 'bg-error/10 text-error',
  error: 'bg-error/10 text-error',
  offline: 'bg-error/10 text-error',
  suspended: 'bg-error/10 text-error',
  cancelled: 'bg-text-muted/10 text-text-muted',
  unpaid: 'bg-text-muted/10 text-text-muted',
  maintenance: 'bg-warning/10 text-warning',
  inactive: 'bg-text-muted/10 text-text-muted',
  revoked: 'bg-error/10 text-error',
};

export function StatusPill({ status, className = '' }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status?.toLowerCase()] ?? 'bg-text-muted/10 text-text-muted';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium capitalize whitespace-nowrap ${tone} ${className}`}
    >
      {/* The dot is decoration; the text carries the meaning. */}
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
      {status?.replace(/_/g, ' ') || 'unknown'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  loading = false,
  trend,
  bare = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'error';
  loading?: boolean;
  trend?: TrendProps;
  /** Render bare, for use inside a StatStrip rather than as its own card. */
  bare?: boolean;
}) {
  const Wrapper = bare ? BareStat : Card;
  const tones: Record<string, string> = {
    default: 'text-text',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  };

  return (
    <Wrapper className="p-4 sm:p-5 min-w-0">
      <div className="flex items-center gap-2">
        {icon && (
          <span
            aria-hidden="true"
            className="w-6 h-6 rounded-md bg-surface-sunken text-text-muted flex items-center justify-center flex-shrink-0"
          >
            {icon}
          </span>
        )}
        <p className="text-[13px] font-medium text-text-muted truncate">{label}</p>
      </div>
      {loading ? (
        <div className="skeleton h-8 w-24 mt-3" />
      ) : (
        // clamp() keeps a long figure like ₹1,48,230.00 inside a narrow
        // column instead of overflowing it.
        <p
          className={`font-semibold mt-3 tabular tracking-tight whitespace-nowrap ${tones[tone]}`}
          style={{ fontSize: 'clamp(1.375rem, 1.1rem + 0.9vw, 1.875rem)', lineHeight: 1.1 }}
        >
          {value}
        </p>
      )}
      {trend && !loading && <Trend {...trend} />}
      {hint && !loading && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </Wrapper>
  );
}

function BareStat({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

/**
 * Several stats in one card, divided by hairlines. Reads as one summary rather
 * than four competing boxes, and gives each figure more horizontal room.
 */
export function StatStrip({ children }: { children: React.ReactNode }) {
  return (
    <Card className="grid grid-cols-2 lg:grid-cols-4 overflow-hidden [&>*]:border-border/70 [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b lg:[&>*]:border-b-0 lg:[&>*:not(:last-child)]:border-r">
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

export interface TrendProps {
  /** Percentage change, or null when there was nothing to compare against. */
  pct: number | null;
  /** Whether there is any current activity; decides between "new" and "-". */
  hasCurrent?: boolean;
  /** For metrics where going up is bad, such as failed jobs. */
  invert?: boolean;
  /** Screen-reader and tooltip wording, e.g. "vs the same point last month". */
  label: string;
}

/**
 * Period-over-period change.
 *
 * Direction is carried by an arrow and the words "up"/"down" for assistive
 * technology, not by colour alone, so it reads correctly in greyscale and for
 * colour-blind users.
 */
export function Trend({ pct, hasCurrent = true, invert = false, label }: TrendProps) {
  if (pct === null) {
    return (
      <p className="text-xs text-text-muted mt-1" title={label}>
        {hasCurrent ? 'New this period' : 'No change'}
      </p>
    );
  }

  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  const good = flat ? null : invert ? !up : up;
  const tone = good === null ? 'text-text-muted' : good ? 'text-success' : 'text-error';

  return (
    // The label sits on its own line: on a two-column phone grid there is no
    // room beside the figure, and a truncated "vs this p…" says nothing.
    <p className="text-xs mt-1.5 leading-relaxed" title={label}>
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded-md font-medium tabular whitespace-nowrap ${tone} ${
          good === null ? 'bg-text-muted/10' : good ? 'bg-success/10' : 'bg-error/10'
        }`}
      >
        <span aria-hidden="true">{flat ? '→' : up ? '↑' : '↓'}</span>{' '}
        <span className="sr-only">{flat ? 'Unchanged' : up ? 'Up' : 'Down'} </span>
        {flat ? '0%' : `${Math.abs(pct)}%`}
      </span>{' '}
      <span className="text-text-muted">{label}</span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Feedback states
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4">
      {icon && (
        <div
          aria-hidden="true"
          className="w-12 h-12 mx-auto rounded-2xl bg-surface-sunken flex items-center justify-center text-text-muted mb-3"
        >
          {icon}
        </div>
      )}
      <p className="font-semibold text-text">{title}</p>
      {message && <p className="text-sm text-text-muted mt-1 max-w-sm mx-auto">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="text-center py-10 px-4">
      <p className="font-semibold text-error">Something went wrong</p>
      <p className="text-sm text-text-muted mt-1">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-12 w-full" />
      ))}
    </div>
  );
}

/**
 * Announces async results to screen readers. Visual users see the toast;
 * without this, someone using a screen reader gets no feedback at all.
 */
export function Toast({
  message,
  tone = 'success',
  onDismiss,
}: {
  message: string;
  tone?: 'success' | 'error';
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[calc(var(--mobile-nav-height)+1.75rem+env(safe-area-inset-bottom))] lg:bottom-6 sm:bottom-6 sm:left-auto sm:right-6 sm:inset-x-auto z-50 animate-in"
    >
      <div
        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-float sm:max-w-sm ${
          tone === 'success'
            ? 'bg-surface border-success/40 text-text'
            : 'bg-surface border-error/40 text-text'
        }`}
      >
        <span
          aria-hidden="true"
          className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
            tone === 'success' ? 'bg-success' : 'bg-error'
          }`}
        />
        <p className="text-sm flex-1">{message}</p>
        <button
          onClick={onDismiss}
          className="text-text-muted hover:text-text p-1 -m-1"
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-text mb-1.5">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-text-muted mt-1">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-error mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-border bg-surface text-text text-sm shadow-card ' +
  'placeholder:text-text-muted/70 transition-[border-color,box-shadow] hover:border-text-muted/40 ' +
  'focus:border-primary focus:shadow-[0_0_0_3px_rgb(var(--color-primary)/0.15)]';

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    // Move focus into the dialog so keyboard and screen-reader users land
    // inside it rather than continuing through the page behind.
    ref.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto bg-surface
          rounded-t-[1.5rem] sm:rounded-2xl border border-border shadow-float animate-sheet"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-surface z-10">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-text-muted hover:text-text hover:bg-text/5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-5 pt-1" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------

/**
 * Title block at the top of every page. The eyebrow gives orientation (which
 * area you are in) without repeating the title in the top bar.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted mt-1.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
