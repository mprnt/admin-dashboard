import React from 'react';
import { Icon } from '@/components/Icon';
import { SUPPORT, supportMailto, supportTel } from '@/lib/support';

/**
 * How shop staff reach MPrnt. Shown only to shop accounts: a super admin is
 * MPrnt, so offering them MPrnt's own phone number would be noise.
 *
 * Real mailto:/tel: links rather than a form: on a phone, "Call" should dial,
 * and an email from their own client leaves them a copy of what they sent.
 */
export function SupportCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border/70 bg-surface shadow-card ${compact ? 'p-3' : 'p-4'}`}>
      <p className="text-sm font-semibold text-text">Need help from MPrnt?</p>
      <p className="text-xs text-text-muted mt-0.5">Refunds, pricing, printers or anything else.</p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <a
          href={supportMailto('MPrnt support request')}
          className="inline-flex items-center justify-center gap-1.5 min-h-[38px] rounded-xl border border-border bg-surface text-[13px] font-medium text-text hover:bg-surface-secondary"
        >
          <Icon name="mail" className="w-4 h-4" />
          Email
        </a>
        <a
          href={supportTel}
          className="inline-flex items-center justify-center gap-1.5 min-h-[38px] rounded-xl bg-primary text-white text-[13px] font-medium hover:bg-primary-dark"
        >
          <Icon name="phone" className="w-4 h-4" />
          Call
        </a>
      </div>
      {/* Written out too: someone at a desktop with no mail app or phone
          link handler still needs to read and copy them. */}
      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-text-muted">Email</dt>
          <dd className="text-text font-medium truncate select-all">{SUPPORT.email}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-text-muted">Phone</dt>
          <dd className="text-text font-medium tabular select-all">{SUPPORT.phone.display}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * One-line "contact MPrnt" with both channels, for places that tell a shop
 * admin to get in touch (refunds, pricing). The email is pre-addressed.
 */
export function ContactLine({
  children,
  subject,
  body,
  className = '',
}: {
  children: React.ReactNode;
  subject: string;
  body?: string;
  className?: string;
}) {
  return (
    <p className={`text-xs text-text-muted flex flex-wrap items-center gap-x-1.5 gap-y-1 ${className}`}>
      <Icon name="shield" className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{children}</span>
      <a href={supportMailto(subject, body)} className="font-medium text-accent hover:underline">
        {SUPPORT.email}
      </a>
      <span aria-hidden="true">·</span>
      <a href={supportTel} className="font-medium text-accent hover:underline tabular">
        {SUPPORT.phone.display}
      </a>
    </p>
  );
}
