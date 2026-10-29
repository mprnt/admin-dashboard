import type { AttentionRow, KioskRow, PrinterRow, SessionRow } from '@/lib/api';
import { relativeAge } from '@/lib/format';

/**
 * Turns the system's status words into the words a shop owner would use.
 * Every page reads from here, so "queued" is never shown as "queued" and a
 * printer is never "silent" or "offline" in a way that needs decoding.
 */

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

export interface Plain {
  label: string;
  /** One sentence saying what it means for the shop right now. */
  detail: string;
  tone: Tone;
}

export function printerState(p: PrinterRow): Plain {
  if (p.status === 'revoked') {
    return {
      label: 'Turned off',
      detail: 'It cannot print. MPRNT has turned it off. Contact MPRNT to switch it back on.',
      tone: 'bad',
    };
  }
  if (p.status === 'offline' || p.silent) {
    const seen =
      p.secondsSinceHeartbeat !== null ? `Last seen ${relativeAge(p.secondsSinceHeartbeat)}.` : 'It has never connected.';
    return {
      label: 'Not connected',
      detail: `Check it has power and internet. ${seen}`,
      tone: 'bad',
    };
  }
  if (p.status === 'busy') {
    return { label: 'Printing now', detail: 'Working through customer jobs.', tone: 'info' };
  }
  if (p.status === 'online') {
    return { label: 'Ready', detail: 'Ready for the next customer.', tone: 'good' };
  }
  return { label: 'Checking', detail: 'Waiting for the first update from this printer.', tone: 'neutral' };
}

export function qrState(k: KioskRow): Plain {
  if (k.status === 'suspended' || k.status === 'inactive') {
    return { label: 'Paused', detail: 'Customers cannot print here right now.', tone: 'neutral' };
  }
  if (k.printersTotal === 0) {
    return {
      label: 'No printer yet',
      detail: 'Customers can pay here, but nothing will print. Contact MPRNT to add a printer.',
      tone: 'warn',
    };
  }
  if (k.printersOnline === 0) {
    return {
      label: 'Not printing',
      detail: `None of its ${plural(k.printersTotal, 'printer')} is connected.`,
      tone: 'bad',
    };
  }
  if (k.printersOnline < k.printersTotal) {
    return {
      label: 'Partly working',
      detail: `${k.printersOnline} of ${k.printersTotal} printers are ready. Jobs go to the free ones.`,
      tone: 'warn',
    };
  }
  return {
    label: 'Working',
    detail: `All ${plural(k.printersTotal, 'printer')} ready.`,
    tone: 'good',
  };
}

/** A print job as the customer and the shop see it: paid, waiting, printed or failed. */
export function jobState(job: Pick<SessionRow | AttentionRow, 'status'> & { paymentStatus?: string; queueStatus?: string | null }): Plain {
  const status = (job.queueStatus || job.status || '').toLowerCase();
  if (job.paymentStatus && job.paymentStatus !== 'paid') {
    return { label: 'Not paid', detail: 'The customer has not paid for this job.', tone: 'neutral' };
  }
  switch (status) {
    case 'completed':
      return { label: 'Printed', detail: 'Printed and collected.', tone: 'good' };
    case 'printing':
      return { label: 'Printing now', detail: 'Printing at the moment.', tone: 'info' };
    case 'queued':
    case 'assigned':
      return { label: 'Waiting to print', detail: 'Paid, and waiting for a free printer.', tone: 'warn' };
    case 'pending':
      return { label: 'Starting', detail: 'The job is being set up.', tone: 'neutral' };
    case 'failed':
      return { label: 'Could not print', detail: 'The printer could not finish this job.', tone: 'bad' };
    case 'cancelled':
      return { label: 'Cancelled', detail: 'This job was cancelled.', tone: 'neutral' };
    default:
      return { label: 'Unknown', detail: 'Ask MPRNT if this does not change.', tone: 'neutral' };
  }
}

/** Colour, black and white, and the sides, in one short phrase. */
export function printSummary(settings: SessionRow['settings']): string {
  const colour = settings.colorMode === 'color' ? 'Colour' : 'Black and white';
  const sides = settings.printSides === 'double' ? 'double-sided' : 'single-sided';
  const copies = settings.copies > 1 ? `, ${settings.copies} copies` : '';
  return `${colour}, ${sides}${copies}`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
