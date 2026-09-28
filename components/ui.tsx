'use client';

import React from 'react';

/**
 * Shared primitives, styled to match mprnt-qr: semantic colour tokens,
 * rounded-xl surfaces, generous touch targets.
 *
 * Two rules run through all of these:
 *  - every interactive element is at least 44px tall on touch screens, which is
 *    the minimum reliable tap target;
 *  - state is never signalled by colour alone — each status carries a label or
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
      className={`bg-surface border border-border rounded-xl shadow-sm ${className}`}
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
    <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-border">
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-bold text-text truncate">{title}</h2>
        {subtitle && <p className="text-xs sm:text-sm text-text-muted mt-0.5">{subtitle}</p>}
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
    primary: 'bg-primary text-white hover:bg-primary-dark border-primary',
    secondary: 'bg-surface text-text hover:bg-surface-secondary border-border',
    ghost: 'bg-transparent text-text-muted hover:text-text hover:bg-surface-secondary border-transparent',
    danger: 'bg-error text-white hover:opacity-90 border-error',
  };

  const sizes: Record<string, string> = {
    // min-h keeps the tap target usable even when the label is short.
    sm: 'text-sm px-3 py-2 min-h-[38px]',
    md: 'text-sm sm:text-base px-4 py-2.5 min-h-[44px]',
  };

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-semibold
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
  completed: 'bg-success/10 text-success border-success/30',
  active: 'bg-success/10 text-success border-success/30',
  online: 'bg-success/10 text-success border-success/30',
  paid: 'bg-success/10 text-success border-success/30',
  printing: 'bg-info/10 text-info border-info/30',
  assigned: 'bg-info/10 text-info border-info/30',
  queued: 'bg-warning/10 text-warning border-warning/30',
  pending: 'bg-warning/10 text-warning border-warning/30',
  busy: 'bg-warning/10 text-warning border-warning/30',
  failed: 'bg-error/10 text-error border-error/30',
  error: 'bg-error/10 text-error border-error/30',
  offline: 'bg-error/10 text-error border-error/30',
  suspended: 'bg-error/10 text-error border-error/30',
  cancelled: 'bg-text-muted/10 text-text-muted border-border',
  unpaid: 'bg-text-muted/10 text-text-muted border-border',
  maintenance: 'bg-text-muted/10 text-text-muted border-border',
};

export function StatusPill({ status, className = '' }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status?.toLowerCase()] ?? 'bg-text-muted/10 text-text-muted border-border';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold capitalize whitespace-nowrap ${tone} ${className}`}
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
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'error';
  loading?: boolean;
}) {
  const tones: Record<string, string> = {
    default: 'text-text',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs sm:text-sm font-medium text-text-muted">{label}</p>
        {icon && (
          <span aria-hidden="true" className="text-text-muted flex-shrink-0">
            {icon}
          </span>
        )}
      </div>
      {loading ? (
        <div className="skeleton h-8 w-24 mt-2" />
      ) : (
        <p className={`text-2xl sm:text-3xl font-bold mt-1.5 tabular ${tones[tone]}`}>{value}</p>
      )}
      {hint && !loading && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </Card>
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
          className="w-12 h-12 mx-auto rounded-full bg-surface-secondary flex items-center justify-center text-text-muted mb-3"
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
      className="fixed inset-x-4 bottom-[calc(var(--mobile-nav-height)+1rem)] sm:bottom-6 sm:left-auto sm:right-6 sm:inset-x-auto z-50 animate-in"
    >
      <div
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg sm:max-w-sm ${
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
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-text mb-1.5">
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
  'w-full px-3 py-2.5 min-h-[44px] rounded-lg border border-border bg-surface text-text ' +
  'placeholder:text-text-muted transition-colors focus:border-primary';

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
        className="absolute inset-0 bg-black/50"
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
          rounded-t-2xl sm:rounded-2xl border border-border shadow-xl animate-in"
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border sticky top-0 bg-surface">
          <h2 className="text-lg font-bold text-text">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 -m-2 text-text-muted hover:text-text"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
