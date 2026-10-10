'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { api, ApiError, type AdminUserRow } from '@/lib/api';
import { dateTime } from '@/lib/format';
import {
  Card,
  CardHeader,
  PageHeader,
  StatusPill,
  EmptyState,
  ErrorState,
  SkeletonRows,
  Button,
  Modal,
  Toast,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useProfile } from '@/lib/useProfile';

export default function StaffPage() {
  const profile = useProfile();
  const canWrite = profile?.permissions.includes('staff:write');

  const { data, error, loading, reload } = useApi<{ count: number; users: AdminUserRow[] }>(
    '/users'
  );
  const [credentials, setCredentials] = React.useState<{ email: string; password: string } | null>(
    null
  );
  const [toast, setToast] = React.useState<{ message: string; tone: 'success' | 'error' } | null>(
    null
  );

  async function act(fn: () => Promise<unknown>, successMessage: string) {
    try {
      await fn();
      setToast({ message: successMessage, tone: 'success' });
      reload();
    } catch (e) {
      setToast({
        message: e instanceof ApiError ? e.message : 'Action failed',
        tone: 'error',
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Staff" subtitle="People who can access this dashboard" />

      {canWrite && (
        <p className="text-xs text-text-muted flex items-start gap-2">
          <Icon name="shield" className="w-4 h-4 flex-shrink-0 mt-px" />
          New accounts are issued by MPrnt. Ask your MPrnt contact to add someone to your shop.
        </p>
      )}

      <Card>
        <CardHeader title={`${data?.count ?? 0} accounts`} />

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <SkeletonRows rows={3} />
        ) : data && data.users.length > 0 ? (
          <ul className="divide-y divide-border">
            {data.users.map((u) => (
              <li key={u.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text truncate">
                      {u.fullName || u.email}
                      {u.id === profile?.id && (
                        <span className="text-text-muted font-normal"> (you)</span>
                      )}
                    </p>
                    {u.fullName && (
                      <p className="text-xs text-text-muted truncate">{u.email}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs font-semibold text-accent capitalize">
                      {u.role.replace('_', ' ')}
                    </span>
                    <StatusPill status={u.isActive ? 'active' : 'suspended'} />
                  </div>
                </div>

                <p className="text-xs text-text-muted mt-2">
                  {u.lastLoginAt ? `Last signed in ${dateTime(u.lastLoginAt)}` : 'Never signed in'}
                  {u.mustChangePassword && ' · must change password'}
                </p>

                {canWrite && u.id !== profile?.id && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        act(
                          () => api.patch(`/users/${u.id}`, { isActive: !u.isActive }),
                          u.isActive ? 'Account deactivated' : 'Account reactivated'
                        )
                      }
                    >
                      {u.isActive ? 'Deactivate' : 'Reactivate'}
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        try {
                          const res = await api.post<{ temporaryPassword: string }>(
                            `/users/${u.id}/reset-password`
                          );
                          setCredentials({ email: u.email, password: res.temporaryPassword });
                          reload();
                        } catch (e) {
                          setToast({
                            message: e instanceof ApiError ? e.message : 'Reset failed',
                            tone: 'error',
                          });
                        }
                      }}
                    >
                      <Icon name="key" className="w-4 h-4" />
                      Reset password
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-error"
                      onClick={() => {
                        if (
                          confirm(
                            `Remove ${u.email}? They will be signed out immediately. Their history is kept.`
                          )
                        ) {
                          act(() => api.del(`/users/${u.id}`), 'Account removed');
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No staff accounts" icon={<Icon name="users" className="w-6 h-6" />} />
        )}
      </Card>

      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />

      {toast && (
        <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

function CredentialsModal({
  credentials,
  onClose,
}: {
  credentials: { email: string; password: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  return (
    <Modal open={Boolean(credentials)} title="Account credentials" onClose={onClose}>
      {credentials && (
        <div className="space-y-4">
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-text">
            <strong className="font-semibold">Copy this now.</strong> The password is not stored
            anywhere and cannot be shown again - only reset.
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Email</p>
              <p className="font-mono text-sm text-text break-all">{credentials.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                Temporary password
              </p>
              <p className="font-mono text-base text-text break-all">{credentials.password}</p>
            </div>
          </div>

          <p className="text-xs text-text-muted">
            They will be asked to change it when they first sign in. Send it through a channel you
            trust - not a group chat.
          </p>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={async () => {
                await navigator.clipboard?.writeText(
                  `Email: ${credentials.email}\nPassword: ${credentials.password}`
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Copied' : 'Copy credentials'}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
