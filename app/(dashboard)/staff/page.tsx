'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { api, ApiError, type AdminUserRow, type OrganizationRow } from '@/lib/api';
import { dateTime } from '@/lib/format';
import {
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  ErrorState,
  SkeletonRows,
  Button,
  Modal,
  Field,
  inputClass,
  Toast,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useProfile } from '@/lib/useProfile';

const ROLE_HELP: Record<string, string> = {
  owner: 'Full control of this shop: staff and reports. Refunds go through MPrnt.',
  manager: 'Day-to-day operations and reports. Cannot manage staff.',
  viewer: 'Read-only access to reports.',
};

export default function StaffPage() {
  const profile = useProfile();
  const isSuper = profile?.role === 'super_admin';
  const canWrite = profile?.permissions.includes('staff:write');

  const { data, error, loading, reload } = useApi<{ count: number; users: AdminUserRow[] }>(
    '/users'
  );
  const orgs = useApi<{ organizations: OrganizationRow[] }>(isSuper ? '/organizations' : null);

  const [createOpen, setCreateOpen] = React.useState(false);
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
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Staff</h1>
          <p className="text-sm text-text-muted mt-1.5">
            {isSuper ? 'Everyone with dashboard access' : 'People who can access this dashboard'}
          </p>
        </div>
        {isSuper && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" className="w-4 h-4" />
            Add admin
          </Button>
        )}
      </div>

      {!isSuper && canWrite && (
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
                    {isSuper && u.organizationName && (
                      <p className="text-xs text-text-muted truncate">{u.organizationName}</p>
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

                {canWrite && u.id !== profile?.id && u.role !== 'super_admin' && (
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

      {isSuper && (
        <CreateAdminModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          organizations={orgs.data?.organizations ?? []}
          onCreated={(email, password) => {
            setCreateOpen(false);
            setCredentials({ email, password });
            reload();
          }}
        />
      )}

      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />

      {toast && (
        <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

function CreateAdminModal({
  open,
  onClose,
  organizations,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  organizations: OrganizationRow[];
  onCreated: (email: string, password: string) => void;
}) {
  const [email, setEmail] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [role, setRole] = React.useState('owner');
  const [organizationId, setOrganizationId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setEmail('');
      setFullName('');
      setRole('owner');
      setOrganizationId(organizations[0]?.id ?? '');
      setError(null);
    }
  }, [open, organizations]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await api.post<{ user: AdminUserRow; temporaryPassword: string }>('/users', {
        email,
        fullName: fullName || undefined,
        role,
        organizationId,
      });
      onCreated(res.user.email, res.temporaryPassword);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create the account');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Add an admin" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        <Field label="Email" htmlFor="new-email">
          <input
            id="new-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="owner@shop.com"
          />
        </Field>

        <Field label="Full name" htmlFor="new-name" hint="Optional">
          <input
            id="new-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Organization" htmlFor="new-org">
          <select
            id="new-org"
            required
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className={inputClass}
          >
            {organizations.length === 0 && <option value="">No organizations yet</option>}
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Role" htmlFor="new-role" hint={ROLE_HELP[role]}>
          <select
            id="new-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputClass}
          >
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="viewer">Viewer</option>
          </select>
        </Field>

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={saving} disabled={!organizationId} className="flex-1">
            Create account
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The generated password is shown exactly once - the backend stores only a hash
 * and cannot reproduce it. The copy here says so plainly, because someone who
 * closes this dialog assuming they can find it later will be wrong.
 */
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
