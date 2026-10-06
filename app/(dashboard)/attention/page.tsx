'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { api, ApiError, type AttentionRow, type RefundResult } from '@/lib/api';
import { useCan, useProfile } from '@/lib/useProfile';
import { currency, relativeAge, dateTime } from '@/lib/format';
import {
  Card,
  CardHeader,
  Button,
  Field,
  Modal,
  Toast,
  inputClass,
  StatusPill,
  EmptyState,
  ErrorState,
  SkeletonRows,
} from '@/components/ui';
import { Icon } from '@/components/Icon';

/**
 * Paid jobs that have not printed.
 *
 * This is the page that costs money when nobody looks at it: every row is a
 * customer who has been charged and has nothing to show for it.
 */
export default function AttentionPage() {
  const { data, error, loading, reload } = useApi<{ count: number; jobs: AttentionRow[] }>(
    '/attention'
  );

  const refundCandidates = data?.jobs.filter((j) => j.refundCandidate).length ?? 0;
  // Refunds are issued by the platform (super admin) only. Shop staff see who
  // to contact instead of a button. Hiding the button is courtesy; the backend
  // must also refuse refunds from shop accounts.
  const isSuper = useProfile()?.role === 'super_admin';
  const hasRefundPermission = useCan('refunds:issue');
  const canRefund = isSuper && hasRefundPermission;
  const [refunding, setRefunding] = React.useState<AttentionRow | null>(null);
  const [toast, setToast] = React.useState<{ message: string; tone: 'success' | 'error' } | null>(
    null
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Needs attention</h1>
        <p className="text-sm text-text-muted mt-1.5">
          Jobs that were paid for but have not finished printing
        </p>
      </div>

      {refundCandidates > 0 && (
        <Card className="p-4 border-warning/40 bg-warning/5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="w-9 h-9 rounded-lg bg-warning/15 text-warning flex items-center justify-center flex-shrink-0"
            >
              <Icon name="clock" className="w-5 h-5" />
            </span>
            <div>
              <p className="font-bold text-text">
                {refundCandidates} {refundCandidates === 1 ? 'job has' : 'jobs have'} been waiting
                over an hour
              </p>
              <p className="text-sm text-text-muted mt-0.5">
                These are unlikely to print on their own.{' '}
                {canRefund
                  ? 'Consider refunding the customer.'
                  : 'For a refund, contact your MPrnt administrator.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title={loading ? 'Loading…' : `${data?.count ?? 0} waiting`} />

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <SkeletonRows rows={3} />
        ) : data && data.jobs.length > 0 ? (
          <ul className="divide-y divide-border">
            {data.jobs.map((job) => (
              <li key={job.jobId} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text">
                      {currency(job.amount)}
                      <span className="text-text-muted font-normal"> · {job.kiosk.code}</span>
                    </p>
                    <p className="text-xs text-text-muted font-mono truncate mt-0.5">
                      {job.jobId}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <StatusPill status={job.queueStatus || job.status} />
                    <p
                      className={`text-xs mt-1 ${
                        job.refundCandidate ? 'text-warning font-semibold' : 'text-text-muted'
                      }`}
                    >
                      {relativeAge(job.ageSeconds)}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                  <span>Paid {dateTime(job.createdAt)}</span>
                  {job.retryCount > 0 && <span>{job.retryCount} retries</span>}
                  {job.errorCode && (
                    <span className="text-error font-medium">{job.errorCode}</span>
                  )}
                </div>

                {job.errorMessage && (
                  <p className="mt-1.5 text-xs text-error">{job.errorMessage}</p>
                )}

                {job.refundCandidate &&
                  (canRefund ? (
                    <div className="mt-3">
                      <Button variant="secondary" size="sm" onClick={() => setRefunding(job)}>
                        Refund {currency(job.amount)}
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-text-muted flex items-center gap-1.5">
                      <Icon name="shield" className="w-3.5 h-3.5 flex-shrink-0" />
                      For a refund, contact your MPrnt administrator and quote the job ID above.
                    </p>
                  ))}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nothing waiting"
            message="Every paid job has printed. This is what you want to see."
            icon={<Icon name="check" className="w-6 h-6" />}
          />
        )}
      </Card>

      <RefundModal
        job={refunding}
        onClose={() => setRefunding(null)}
        onRefunded={(result) => {
          setRefunding(null);
          setToast({
            tone: 'success',
            message: result.alreadyRefunded
              ? 'This job had already been refunded.'
              : result.status === 'pending'
                ? `Refund of ${currency(result.amount)} started; the gateway is still processing it.`
                : `Refunded ${currency(result.amount)}.`,
          });
          reload();
        }}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}

/**
 * Full refund of a paid job that never printed. The backend checks the job is
 * still refundable and is idempotent, so a double click cannot pay out twice.
 */
function RefundModal({
  job,
  onClose,
  onRefunded,
}: {
  job: AttentionRow | null;
  onClose: () => void;
  onRefunded: (result: RefundResult) => void;
}) {
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (job) {
      setReason('');
      setError(null);
      setSaving(false);
    }
  }, [job]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!job) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError('Give a short reason (at least 3 characters).');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const result = await api.post<RefundResult>(
        `/print-jobs/${encodeURIComponent(job.jobId)}/refund`,
        { reason: trimmed }
      );
      onRefunded(result);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError('This job can no longer be refunded: it is printing, printed, or not paid.');
      } else if (e instanceof ApiError && e.status === 502) {
        setError('The payment gateway refused the refund. Nothing was changed; try again.');
      } else {
        setError(e instanceof ApiError ? e.message : 'Could not issue the refund');
      }
      setSaving(false);
    }
  }

  return (
    <Modal open={Boolean(job)} title="Refund this job" onClose={onClose}>
      {job && (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}

          <p className="text-sm text-text-muted">
            The customer gets back the full {currency(job.amount)} they paid at kiosk{' '}
            {job.kiosk.code}. The job is cancelled and will not print.
          </p>

          <Field label="Reason" htmlFor="refund-reason">
            <textarea
              id="refund-reason"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
              placeholder="e.g. Printer out of paper for over an hour"
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={saving}>
              Refund {currency(job.amount)}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
