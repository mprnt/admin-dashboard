'use client';

import { useApi } from '@/lib/useApi';
import { currency } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui';

type Phase = 'awaiting_hardware' | 'not_live' | 'free' | 'active' | 'payment_due' | 'overdue';

interface Invoice {
  id: string;
  kind: 'hardware' | 'software';
  label: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  dueOn: string;
  status: 'due' | 'overdue' | 'paid' | 'waived';
  paidOn: string | null;
}

interface BillingResponse {
  hasContract: boolean;
  contract: {
    phase: Phase;
    soldOn: string;
    goLiveOn: string | null;
    freeUntil: string | null;
    paidThrough: string | null;
    nextPayment: { amount: number; dueOn: string; kind: 'hardware' | 'software' } | null;
    terms: { hardwarePrice: number; monthlyPrice: number; freeMonths: number };
    invoices: Invoice[];
    gstInclusive: true;
  } | null;
}

/** A calendar date as the shop reads it: "1 November 2026". Noon avoids any shift across midnight. */
function calendarLong(ymd: string | null): string {
  if (!ymd) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${ymd}T12:00:00`)
  );
}

const INVOICE_LABEL: Record<Invoice['status'], { text: string; tone: string }> = {
  due: { text: 'Due', tone: 'bg-warning/15 text-warning' },
  overdue: { text: 'Overdue', tone: 'bg-error/15 text-error' },
  paid: { text: 'Paid', tone: 'bg-success/15 text-success' },
  waived: { text: 'Waived', tone: 'bg-text-muted/10 text-text-muted' },
};

/** What the shop needs to know, in its own words. Read only: changes go through MPrnt. */
function headline(c: NonNullable<BillingResponse['contract']>): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  const next = c.nextPayment;
  switch (c.phase) {
    case 'awaiting_hardware':
      return { text: 'Your printer kit is waiting for payment. MPrnt sets up your station once it is paid.', tone: 'warn' };
    case 'not_live':
      return { text: 'Your kit is paid. Your subscription starts when MPrnt confirms you are live.', tone: 'ok' };
    case 'free':
      return {
        text: `Your first month is free. Your first software payment of ${currency(next?.amount ?? c.terms.monthlyPrice)} is due on ${calendarLong(next?.dueOn ?? null)}.`,
        tone: 'ok',
      };
    case 'active':
      return {
        text: `You are up to date. Paid through ${calendarLong(c.paidThrough)}. Your next payment is ${currency(next?.amount ?? c.terms.monthlyPrice)} on ${calendarLong(next?.dueOn ?? null)}.`,
        tone: 'ok',
      };
    case 'payment_due':
      return {
        text: `A payment of ${currency(next?.amount ?? 0)} was due on ${calendarLong(next?.dueOn ?? null)}. Please pay MPrnt to keep your subscription up to date.`,
        tone: 'warn',
      };
    case 'overdue':
      return {
        text: `A payment of ${currency(next?.amount ?? 0)} from ${calendarLong(next?.dueOn ?? null)} is overdue. Please pay MPrnt as soon as you can.`,
        tone: 'bad',
      };
  }
}

const TONE_CLASS = { ok: 'text-text', warn: 'text-warning', bad: 'text-error' } as const;

/**
 * The partner's Model 1 subscription, read only. Shows when it started, what
 * was paid for the kit, what the monthly fee is and when the next payment is
 * due. Renders nothing for a partner with no Model 1 contract.
 */
export function BillingCard() {
  const billing = useApi<BillingResponse>('/billing/contract');

  if (billing.loading || !billing.data?.hasContract || !billing.data.contract) return null;

  const c = billing.data.contract;
  const kit = c.invoices.find((i) => i.kind === 'hardware');
  const software = c.invoices.filter((i) => i.kind === 'software').slice(-12).reverse();
  const message = headline(c);

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Your subscription" subtitle="Printer integration · prices include GST" />

      <div className="space-y-4 px-4 pb-5 sm:px-5">
        <p className={`text-sm leading-relaxed ${TONE_CLASS[message.tone]}`}>{message.text}</p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs text-text-muted">Started</dt>
            <dd className="font-medium text-text">{c.goLiveOn ? calendarLong(c.goLiveOn) : 'Not started'}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Printer kit</dt>
            <dd className="font-medium text-text">
              {currency(kit?.amount ?? c.terms.hardwarePrice)}
              {kit && (
                <span className={`ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-medium ${INVOICE_LABEL[kit.status].tone}`}>
                  {INVOICE_LABEL[kit.status].text}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Software</dt>
            <dd className="font-medium text-text">
              {currency(c.terms.monthlyPrice)} a month
              <span className="block text-xs font-normal text-text-muted">
                {c.terms.freeMonths > 0
                  ? `First ${c.terms.freeMonths === 1 ? 'month' : `${c.terms.freeMonths} months`} free${c.freeUntil ? `, to ${calendarLong(c.freeUntil)}` : ''}`
                  : 'No free month'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Next payment</dt>
            <dd className="font-medium text-text">
              {c.nextPayment ? `${currency(c.nextPayment.amount)}` : '—'}
              {c.nextPayment && <span className="block text-xs font-normal text-text-muted">due {calendarLong(c.nextPayment.dueOn)}</span>}
            </dd>
          </div>
        </dl>

        {software.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <caption className="sr-only">Software payments</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Month</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Due</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {software.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 pr-3 text-text">{i.label.replace('Software, ', '')}</td>
                    <td className="py-2 pr-3 text-text-muted">{calendarLong(i.dueOn)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-text">{currency(i.amount)}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_LABEL[i.status].tone}`}>
                        {INVOICE_LABEL[i.status].text}
                        {i.status === 'paid' && i.paidOn ? ` on ${calendarLong(i.paidOn)}` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-text-muted">
          To change anything on this subscription, contact MPrnt. Payments are recorded by MPrnt.
        </p>
      </div>
    </Card>
  );
}
