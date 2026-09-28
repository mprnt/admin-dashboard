'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { api, ApiError, type OrganizationRow, type KioskRow } from '@/lib/api';
import { dateOnly } from '@/lib/format';
import {
  Card, CardHeader, StatusPill, EmptyState, ErrorState, SkeletonRows,
  Button, Modal, Field, inputClass, Toast,
} from '@/components/ui';
import { Icon } from '@/components/Icon';

/** Platform-scope page: creating and suspending the shops that use MPrnt. */
export default function OrganizationsPage() {
  const { data, error, loading, reload } = useApi<{ count: number; organizations: OrganizationRow[] }>(
    '/organizations'
  );
  const kiosks = useApi<{ kiosks: KioskRow[] }>('/kiosks');

  const [createOpen, setCreateOpen] = React.useState(false);
  const [assignFor, setAssignFor] = React.useState<OrganizationRow | null>(null);
  const [toast, setToast] = React.useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  async function act(fn: () => Promise<unknown>, message: string) {
    try {
      await fn();
      setToast({ message, tone: 'success' });
      reload();
      kiosks.reload();
    } catch (e) {
      setToast({ message: e instanceof ApiError ? e.message : 'Action failed', tone: 'error' });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text">Organizations</h1>
          <p className="text-sm text-text-muted">Shops running MPrnt kiosks</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" className="w-4 h-4" />
          New organization
        </Button>
      </div>

      <Card>
        <CardHeader title={`${data?.count ?? 0} organizations`} />

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <SkeletonRows rows={3} />
        ) : data && data.organizations.length > 0 ? (
          <ul className="divide-y divide-border">
            {data.organizations.map((org) => (
              <li key={org.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text truncate">{org.name}</p>
                    <p className="text-xs text-text-muted truncate">
                      {org.slug} · {org.timezone}
                    </p>
                    {org.contactEmail && (
                      <p className="text-xs text-text-muted truncate">{org.contactEmail}</p>
                    )}
                  </div>
                  <StatusPill status={org.status} />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-text-muted">
                  <span>{org.kioskCount ?? 0} kiosks</span>
                  <span>{org.adminCount ?? 0} staff</span>
                  <span>since {dateOnly(org.createdAt)}</span>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <Button variant="secondary" size="sm" onClick={() => setAssignFor(org)}>
                    Assign kiosk
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      act(
                        () =>
                          api.post(`/organizations/${org.id}/status`, {
                            status: org.status === 'active' ? 'suspended' : 'active',
                          }),
                        org.status === 'active' ? 'Organization suspended' : 'Organization reactivated'
                      )
                    }
                  >
                    {org.status === 'active' ? 'Suspend' : 'Reactivate'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-error"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete ${org.name}? All their staff are signed out. Reassign their kiosks first.`
                        )
                      ) {
                        act(() => api.del(`/organizations/${org.id}`), 'Organization deleted');
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>

                {org.status === 'suspended' && (
                  <p className="text-xs text-error mt-2">
                    Staff cannot sign in while this organization is suspended.
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No organizations yet"
            message="Create one, then assign it a kiosk and an owner."
            icon={<Icon name="building" className="w-6 h-6" />}
          />
        )}
      </Card>

      <CreateOrgModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setToast({ message: 'Organization created', tone: 'success' });
          reload();
        }}
      />

      <AssignKioskModal
        org={assignFor}
        kiosks={kiosks.data?.kiosks ?? []}
        onClose={() => setAssignFor(null)}
        onAssigned={() => {
          setAssignFor(null);
          setToast({ message: 'Kiosk assigned', tone: 'success' });
          reload();
          kiosks.reload();
        }}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function CreateOrgModal({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = React.useState('');
  const [timezone, setTimezone] = React.useState('Asia/Kolkata');
  const [contactEmail, setContactEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) { setName(''); setContactEmail(''); setError(null); }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post('/organizations', {
        name,
        timezone,
        contactEmail: contactEmail || undefined,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="New organization" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}
        <Field label="Shop name" htmlFor="org-name">
          <input id="org-name" required value={name} onChange={(e) => setName(e.target.value)}
            className={inputClass} placeholder="Sharma Xerox" />
        </Field>
        <Field
          label="Timezone"
          htmlFor="org-tz"
          hint="Daily, weekly and monthly reports are bucketed in this timezone."
        >
          <select id="org-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputClass}>
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="Asia/Singapore">Asia/Singapore</option>
            <option value="Europe/London">Europe/London</option>
            <option value="America/New_York">America/New_York</option>
            <option value="UTC">UTC</option>
          </select>
        </Field>
        <Field label="Contact email" htmlFor="org-email" hint="Optional">
          <input id="org-email" type="email" value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
        </Field>
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={saving} className="flex-1">Create</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

function AssignKioskModal({
  org, kiosks, onClose, onAssigned,
}: {
  org: OrganizationRow | null;
  kiosks: KioskRow[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [kioskId, setKioskId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { setKioskId(''); setError(null); }, [org]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/organizations/${org!.id}/kiosks`, { kioskId });
      onAssigned();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not assign');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={Boolean(org)} title={`Assign a kiosk to ${org?.name ?? ''}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}
        <Field
          label="Kiosk"
          htmlFor="assign-kiosk"
          hint="Moving a kiosk transfers its future jobs to this organization. Past reports stay where they were."
        >
          <select id="assign-kiosk" required value={kioskId}
            onChange={(e) => setKioskId(e.target.value)} className={inputClass}>
            <option value="">Select a kiosk…</option>
            {kiosks.map((k) => (
              <option key={k.id} value={k.id}>
                {k.kioskId} — {k.name}
                {k.organizationName ? ` (currently ${k.organizationName})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex gap-2">
          <Button type="submit" loading={saving} disabled={!kioskId} className="flex-1">Assign</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
